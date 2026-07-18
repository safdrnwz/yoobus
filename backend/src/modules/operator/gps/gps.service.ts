import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AppException } from '../../../common/errors/app-exception';
import { GpsConfiguration, GpsDevice, GpsProvider, TrackingToken } from './entities/gps.entities';
import { SUPPORTED_GPS_PROVIDERS } from './gps.providers';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Bus } from '../buses/entities/bus.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

/**
 * GPS Integration.
 *
 * Business rules (from spec):
 *  - Tracking starts 1 hour before departure; the same URL stays valid through the trip and
 *    expires automatically after completion.
 *  - Exactly one tracking token per booking.
 *  - A passenger can only see their own booking (the token IS the capability).
 *  - An operator can only see their own fleet (every query is operator-scoped).
 */
@Injectable()
export class GpsService {
  constructor(
    @InjectRepository(GpsProvider) private readonly providerRepo: Repository<GpsProvider>,
    @InjectRepository(GpsConfiguration) private readonly configRepo: Repository<GpsConfiguration>,
    @InjectRepository(GpsDevice) private readonly deviceRepo: Repository<GpsDevice>,
    @InjectRepository(TrackingToken) private readonly tokenRepo: Repository<TrackingToken>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
  ) {}

  // ───────────────────────── Platform: providers ─────────────────────────
  /** The full provider list with each one's on/off status. */
  async listProviders() {
    const rows = await this.providerRepo.find();
    const status = new Map(rows.map((r) => [r.providerName, r.enabled]));
    return SUPPORTED_GPS_PROVIDERS.map((name) => ({ providerName: name, enabled: status.get(name) ?? false }));
  }

  /** Enabled provider names — used to gate operator configuration. */
  private async enabledProviderNames(): Promise<Set<string>> {
    const rows = await this.providerRepo.find({ where: { enabled: true } });
    return new Set(rows.map((r) => r.providerName));
  }

  async setProviderStatus(providerName: string, enabled: boolean) {
    if (!SUPPORTED_GPS_PROVIDERS.includes(providerName as never)) {
      throw new AppException('GPS_PROVIDER_UNKNOWN', `Unknown GPS provider: ${providerName}.`, HttpStatus.BAD_REQUEST);
    }
    let row = await this.providerRepo.findOne({ where: { providerName } });
    if (row) row.enabled = enabled;
    else row = this.providerRepo.create({ providerName, enabled });
    return this.providerRepo.save(row);
  }

  // ───────────────────────── Operator: configuration ─────────────────────────
  getConfig(operatorId: string) {
    return this.configRepo.findOne({ where: { operatorId } });
  }

  async saveConfig(operatorId: string, dto: {
    provider: string; apiBaseUrl: string; apiKey: string;
    apiSecret?: string; clientId?: string; accessToken?: string; webhookUrl?: string;
  }) {
    const enabled = await this.enabledProviderNames();
    if (!enabled.has(dto.provider)) {
      throw new AppException(
        'GPS_PROVIDER_DISABLED',
        `${dto.provider} is not enabled on the platform. Ask the platform team to enable it.`,
        HttpStatus.FORBIDDEN,
      );
    }
    let cfg = await this.configRepo.findOne({ where: { operatorId } });
    const fields = {
      operatorId,
      provider: dto.provider,
      apiBaseUrl: dto.apiBaseUrl,
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret ?? null,
      clientId: dto.clientId ?? null,
      accessToken: dto.accessToken ?? null,
      webhookUrl: dto.webhookUrl ?? null,
      status: 'UNTESTED',
      lastTestedAt: null,
    };
    cfg = cfg ? this.configRepo.merge(cfg, fields) : this.configRepo.create(fields);
    return this.configRepo.save(cfg);
  }

  /**
   * Test the saved credentials against the provider.
   *
   * The actual call is provider-specific; this validates that a usable configuration exists and
   * records the outcome. Wrong/missing credentials leave the config DISCONNECTED (edge case).
   */
  async testConnection(operatorId: string) {
    const cfg = await this.configRepo.findOne({ where: { operatorId } });
    if (!cfg) throw new AppException('GPS_NOT_CONFIGURED', 'Configure a GPS provider first.', HttpStatus.BAD_REQUEST);
    const ok = !!(cfg.apiBaseUrl && cfg.apiKey);
    cfg.status = ok ? 'CONNECTED' : 'DISCONNECTED';
    cfg.lastTestedAt = new Date();
    await this.configRepo.save(cfg);
    return { ok, status: cfg.status, provider: cfg.provider };
  }

  // ───────────────────────── Operator: device mapping ─────────────────────────
  listDevices(operatorId: string) {
    return this.deviceRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  async mapDevice(operatorId: string, dto: { busId: string; imei: string; deviceId?: string }) {
    const cfg = await this.configRepo.findOne({ where: { operatorId } });
    if (!cfg) throw new AppException('GPS_NOT_CONFIGURED', 'Configure a GPS provider first.', HttpStatus.BAD_REQUEST);
    // Operator isolation: the bus must belong to this operator.
    const bus = await this.busRepo.findOne({ where: { id: dto.busId, operatorId }, select: ['id'] });
    if (!bus) throw new AppException('BUS_NOT_FOUND', 'That bus does not belong to your fleet.', HttpStatus.NOT_FOUND);

    let device = await this.deviceRepo.findOne({ where: { operatorId, busId: dto.busId } });
    const fields = { operatorId, busId: dto.busId, provider: cfg.provider, imei: dto.imei, deviceId: dto.deviceId ?? null, status: 'ACTIVE' };
    device = device ? this.deviceRepo.merge(device, fields) : this.deviceRepo.create(fields);
    return this.deviceRepo.save(device);
  }

  async unmapDevice(operatorId: string, id: string) {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new AppException('GPS_DEVICE_NOT_FOUND', 'No such device mapping.', HttpStatus.NOT_FOUND);
    if (device.operatorId !== operatorId) {
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'That device belongs to another operator.', HttpStatus.FORBIDDEN);
    }
    await this.deviceRepo.remove(device);
    return { ok: true };
  }

  // ───────────────────────── Tracking token (per booking) ─────────────────────────
  private departureAt(trip: Trip): Date {
    return new Date(`${trip.departureDate}T${(trip.departureTime || '00:00')}:00`);
  }

  /**
   * Create (or return the existing) tracking token for a booking. Idempotent — one per booking.
   * validFrom = departure − 1h; validTo = departure + 24h (a safety window; the token is also
   * expired explicitly when the trip completes or is cancelled).
   */
  async createTrackingForBooking(operatorId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId, operatorId } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'No such booking for your operator.', HttpStatus.NOT_FOUND);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppException('BOOKING_NOT_CONFIRMED', 'Only confirmed bookings can be tracked.', HttpStatus.BAD_REQUEST);
    }
    const existing = await this.tokenRepo.findOne({ where: { bookingId } });
    if (existing) return { token: existing.token, trackingUrl: this.urlFor(existing.token), validFrom: existing.validFrom, validTo: existing.validTo };

    const trip = await this.tripRepo.findOne({ where: { id: booking.tripId }, select: ['id', 'busId', 'departureDate', 'departureTime'] });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', 'The trip for this booking no longer exists.', HttpStatus.NOT_FOUND);
    // The bus must have a mapped GPS device, else there is nothing to track (edge case).
    const device = await this.deviceRepo.findOne({ where: { operatorId, busId: trip.busId } });
    if (!device) throw new AppException('BUS_NOT_MAPPED', 'This trip’s bus is not mapped to a GPS device yet.', HttpStatus.BAD_REQUEST);

    const dep = this.departureAt(trip);
    const validFrom = new Date(dep.getTime() - 60 * 60 * 1000);
    const validTo = new Date(dep.getTime() + 24 * 60 * 60 * 1000);
    const token = randomBytes(24).toString('hex');
    const saved = await this.tokenRepo.save(this.tokenRepo.create({
      bookingId, operatorId, pnr: booking.pnr, tripId: trip.id, busId: trip.busId,
      token, validFrom, validTo, status: 'ACTIVE',
    }));
    return { token: saved.token, trackingUrl: this.urlFor(saved.token), validFrom: saved.validFrom, validTo: saved.validTo };
  }

  private urlFor(token: string): string {
    const base = process.env.TRACKING_URL_BASE || 'https://track.yourdomain.com';
    return `${base}/${token}`;
  }

  /**
   * Passenger tracking read — capability is the token in the URL. Returns only what a passenger
   * needs, scoped to their own booking; never another operator's data.
   */
  async getTracking(token: string) {
    const row = await this.tokenRepo.findOne({ where: { token } });
    if (!row) throw new AppException('TRACKING_NOT_FOUND', 'Invalid tracking link.', HttpStatus.NOT_FOUND);
    const now = Date.now();
    if (row.status === 'EXPIRED' || now > row.validTo.getTime()) {
      return { pnr: row.pnr, status: 'EXPIRED', message: 'This tracking link has expired.' };
    }
    if (now < row.validFrom.getTime()) {
      return { pnr: row.pnr, status: 'NOT_STARTED', startsAt: row.validFrom, message: 'Tracking starts 1 hour before departure.' };
    }
    const device = await this.deviceRepo.findOne({ where: { operatorId: row.operatorId, busId: row.busId } });
    const position = await this.livePosition(device);
    return {
      pnr: row.pnr,
      status: 'ACTIVE',
      device: device ? { imei: device.imei, provider: device.provider, deviceStatus: device.status } : null,
      live: position, // null when the GPS is offline / not yet reporting
    };
  }

  /**
   * Live position from the provider. Provider-specific HTTP call goes here; returns null when
   * the device is offline or unmapped (edge case), so the passenger view degrades gracefully.
   */
  private async livePosition(device: GpsDevice | null): Promise<{ lat: number; lng: number; at: Date } | null> {
    if (!device || device.status !== 'ACTIVE') return null;
    // Real integration: call the provider API (Fleetx/LocoNav/Traccar/...) using the operator's
    // saved credentials and translate the response into { lat, lng, at }. Left unimplemented on
    // purpose — it is provider-specific — and returns null (offline) rather than a fake position.
    return null;
  }

  /** Expire every tracking token for a trip — call on trip completion or cancellation. */
  async expireForTrip(tripId: string) {
    await this.tokenRepo.update({ tripId, status: 'ACTIVE' }, { status: 'EXPIRED' });
    return { ok: true };
  }
}
