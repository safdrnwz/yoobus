import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesChannel } from './entities/sales-channel.entity';
import { BookingSeat } from '../../booking/bookings/entities/booking-seat.entity';
import { AppException } from '../../../common/errors/app-exception';

/** OTA/GDS distribution registry + central inventory view (Phase 3). */
@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(SalesChannel) private readonly channelRepo: Repository<SalesChannel>,
    @InjectRepository(BookingSeat) private readonly seatRepo: Repository<BookingSeat>,
  ) {}

  async register(operatorId: string, dto: { code: string; displayName: string; channelCommissionRate?: number }) {
    const exists = await this.channelRepo.findOne({ where: { operatorId, code: dto.code.toUpperCase() } });
    if (exists) throw new AppException('CHANNEL_EXISTS', 'This channel is already registered for the operator', HttpStatus.CONFLICT);
    return this.channelRepo.save(
      this.channelRepo.create({
        operatorId,
        code: dto.code.toUpperCase(),
        displayName: dto.displayName,
        channelCommissionRate: dto.channelCommissionRate ?? 0,
      }),
    );
  }

  listByOperator(operatorId: string): Promise<SalesChannel[]> {
    return this.channelRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  // Central inventory: seats sold across ALL channels for a trip (single source of truth).
  async inventory(tripId: string): Promise<{ tripId: string; soldSeats: string[] }> {
    const seats = await this.seatRepo.find({ where: { tripId, isActive: true } });
    const soldSeats = [...new Set(seats.map((s) => s.seatNumber))];
    return { tripId, soldSeats };
  }
}
