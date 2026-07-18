import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingSeat } from '../../booking/bookings/entities/booking-seat.entity';
import { TripsService } from '../../operator/trips/trips.service';
import { computePriceMultiplier } from '../../../common/logic/pricing.util';

/**
 * Dynamic pricing (Phase 3). Computes a live fare multiplier from real occupancy,
 * time-to-departure and weekend status. Opt-in per deployment via config flag.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(BookingSeat) private readonly seatRepo: Repository<BookingSeat>,
    private readonly trips: TripsService,
    private readonly config: ConfigService,
  ) {}

  async previewForTrip(tripId: string): Promise<{
    tripId: string;
    dynamicEnabled: boolean;
    baseMultiplier: number;
    dynamicMultiplier: number;
    occupancyRatio: number;
    hoursToDeparture: number;
  }> {
    const { trip, bus } = await this.trips.findFull(tripId);
    const soldCount = await this.seatRepo.count({ where: { tripId, isActive: true } });
    const occupancyRatio = bus.totalSeats > 0 ? soldCount / bus.totalSeats : 0;

    const departure = new Date(`${trip.departureDate}T${trip.departureTime}:00`);
    const hoursToDeparture = Math.max(0, (departure.getTime() - Date.now()) / (1000 * 60 * 60));
    const isWeekend = [0, 6].includes(departure.getDay());

    const dynamicEnabled = this.config.get<boolean>('pricing.dynamicEnabled') === true;
    const dynamicMultiplier = computePriceMultiplier({ occupancyRatio, hoursToDeparture, isWeekend });

    return {
      tripId,
      dynamicEnabled,
      baseMultiplier: Number(trip.fareMultiplier),
      dynamicMultiplier,
      occupancyRatio: Math.round(occupancyRatio * 100) / 100,
      hoursToDeparture: Math.round(hoursToDeparture * 10) / 10,
    };
  }
}
