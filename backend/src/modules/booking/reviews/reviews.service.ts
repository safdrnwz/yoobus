import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { AppException } from '../../../common/errors/app-exception';
import { averageRating, isValidRating } from '../../../common/logic/rating.util';
import { Logger } from '@nestjs/common';
import { User } from '../../customer/users/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { EmailService } from '../../integrations/email/email.service';

/** Reviews & ratings (Phase 4). Only travellers with a confirmed trip may review. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async create(userId: string, dto: { tripId: string; rating: number; comment?: string }): Promise<Review> {
    if (!isValidRating(dto.rating)) throw new AppException('INVALID_RATING', 'Rating must be an integer between 1 and 5', HttpStatus.BAD_REQUEST);
    const booking = await this.bookingRepo.findOne({ where: { userId, tripId: dto.tripId, status: BookingStatus.CONFIRMED } });
    if (!booking) throw new AppException('REVIEW_NOT_ALLOWED', 'You can only review a trip you have travelled on', HttpStatus.FORBIDDEN);
    const existing = await this.reviewRepo.findOne({ where: { userId, tripId: dto.tripId } });
    if (existing) throw new AppException('REVIEW_EXISTS', 'You have already reviewed this trip', HttpStatus.CONFLICT);
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({ userId, operatorId: booking.operatorId, tripId: dto.tripId, rating: dto.rating, comment: dto.comment }),
    );
    // Cross-feature signal: a low rating alerts the operator's admins so they can act fast.
    if (dto.rating <= 2) {
      try {
        const admins = await this.userRepo.find({ where: { operatorId: booking.operatorId, role: Role.OPERATOR_ADMIN } });
        for (const a of admins) {
          await this.email.send({ to: a.email, template: 'LOW_RATING_ALERT', vars: { operatorName: a.fullName, rating: dto.rating }, operatorId: booking.operatorId, recipientOperatorId: booking.operatorId });
        }
      } catch (e) { this.logger.error(`Low-rating alert failed: ${(e as Error).message}`); }
    }
    return review;
  }
  private readonly logger = new Logger('Reviews');

  listByOperator(operatorId: string): Promise<Review[]> {
    return this.reviewRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  async operatorRating(operatorId: string): Promise<{ operatorId: string; average: number; count: number }> {
    const reviews = await this.reviewRepo.find({ where: { operatorId } });
    return { operatorId, average: averageRating(reviews.map((r) => r.rating)), count: reviews.length };
  }
}
