import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPassenger } from './entities/saved-passenger.entity';
import { SavePassengerDto, UpdateProfileDto } from './dto/profile.dto';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { AppException } from '../../../common/errors/app-exception';

/** Customer self-service: profile, saved passengers, and a unified dashboard that
 *  integrates wallet, loyalty and booking history in one call. */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(SavedPassenger) private readonly savedRepo: Repository<SavedPassenger>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly users: UsersService,
    private readonly wallet: WalletService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async getProfile(userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new AppException('USER_NOT_FOUND', 'Account not found', HttpStatus.NOT_FOUND);
    return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, emailVerified: u.emailVerified, consentGiven: u.consentGiven, memberSince: u.createdAt };
  }

  updateProfile(userId: string, dto: UpdateProfileDto) { return this.users.updateProfile(userId, dto); }
  profileCompletion(userId: string) { return this.users.profileCompletion(userId); }

  deactivate(userId: string) { return this.users.deactivate(userId); }

  /** One-call unified customer home: profile + wallet + loyalty + recent bookings. */
  async dashboard(userId: string) {
    const [profile, walletBalance, loyalty, recent, totalBookings] = await Promise.all([
      this.getProfile(userId),
      this.wallet.balance(userId),
      this.loyalty.summary(userId),
      this.bookingRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 5 }),
      this.bookingRepo.count({ where: { userId } }),
    ]);
    return {
      profile,
      wallet: { balance: walletBalance },
      loyalty: { points: loyalty.points, referralCode: loyalty.referralCode },
      bookings: {
        total: totalBookings,
        recent: recent.map((b) => ({ id: b.id, pnr: b.pnr, status: b.status, amount: Number(b.payableByPassenger), bookedOn: b.createdAt })),
      },
    };
  }

  async bookingHistory(userId: string, limit = 50) {
    const rows = await this.bookingRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: limit });
    return rows.map((b) => ({ id: b.id, pnr: b.pnr, status: b.status, amount: Number(b.payableByPassenger), tripId: b.tripId, bookedOn: b.createdAt }));
  }

  // ---- Saved passengers ----
  listPassengers(userId: string) { return this.savedRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }); }
  addPassenger(userId: string, dto: SavePassengerDto) {
    return this.savedRepo.save(this.savedRepo.create({ userId, ...dto, age: dto.age ?? null, gender: dto.gender ?? null, idType: dto.idType ?? null, idNumber: dto.idNumber ?? null }));
  }
  async removePassenger(userId: string, id: string) {
    const p = await this.savedRepo.findOne({ where: { id } });
    if (!p || p.userId !== userId) throw new AppException('PASSENGER_NOT_FOUND', 'Saved passenger not found', HttpStatus.NOT_FOUND);
    await this.savedRepo.delete({ id });
    return { ok: true };
  }
}
