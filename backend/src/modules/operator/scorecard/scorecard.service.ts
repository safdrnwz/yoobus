import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../booking/reviews/entities/review.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { DisruptionEvent } from '../disruption/entities/disruption-event.entity';
import { Operator } from '../operators/entities/operator.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { TripStatus } from '../../../common/enums/trip-status.enum';
import { AppException } from '../../../common/errors/app-exception';
import { computeSlaScore, slaGrade } from '../../../common/logic/sla-score.util';

/** Transparent operator quality scorecard built from live reviews, trips, bookings and disruptions. */
@Injectable()
export class ScorecardService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(DisruptionEvent) private readonly disruptionRepo: Repository<DisruptionEvent>,
    @InjectRepository(Operator) private readonly opRepo: Repository<Operator>,
  ) {}

  async forOperator(operatorId: string) {
    const op = await this.opRepo.findOne({ where: { id: operatorId } });
    if (!op) throw new AppException('OPERATOR_NOT_FOUND', 'Operator not found', HttpStatus.NOT_FOUND);

    const [reviews, totalTrips, cancelledTrips, totalBookings, cancelledBookings, disruptions, majorIncidents] = await Promise.all([
      this.reviewRepo.find({ where: { operatorId }, select: ['rating'] }),
      this.tripRepo.count({ where: { operatorId } }),
      this.tripRepo.count({ where: { operatorId, status: TripStatus.CANCELLED } }),
      this.bookingRepo.count({ where: { operatorId } }),
      this.bookingRepo.count({ where: { operatorId, status: BookingStatus.CANCELLED } }),
      this.disruptionRepo.count({ where: { operatorId } }),
      this.disruptionRepo.count({ where: { operatorId, majorIncident: true } }),
    ]);

    const reviewCount = reviews.length;
    const avgRating = reviewCount ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 100) / 100 : 0;
    const tripCancellationRate = totalTrips ? cancelledTrips / totalTrips : 0;
    const bookingCancellationRate = totalBookings ? cancelledBookings / totalBookings : 0;
    const disruptionRate = totalTrips ? disruptions / totalTrips : 0;

    const score = computeSlaScore({ avgRating, tripCancellationRate, bookingCancellationRate, disruptionRate, majorIncidents });
    return {
      operatorId, operatorName: op.brandName || op.legalName, operatorCode: op.operatorCode ?? null,
      score, grade: slaGrade(score),
      metrics: {
        avgRating, reviewCount,
        totalTrips, cancelledTrips, tripCancellationRate: Math.round(tripCancellationRate * 1000) / 10 + '%',
        totalBookings, cancelledBookings, bookingCancellationRate: Math.round(bookingCancellationRate * 1000) / 10 + '%',
        disruptions, majorIncidents,
      },
    };
  }

  /** Public leaderboard: operators ranked by score (for transparency). */
  async leaderboard() {
    const ops = await this.opRepo.find();
    const cards = await Promise.all(ops.map((o) => this.forOperator(o.id).catch(() => null)));
    return cards.filter(Boolean).sort((a: any, b: any) => b.score - a.score);
  }
}
