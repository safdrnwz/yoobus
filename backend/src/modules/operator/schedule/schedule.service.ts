import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripSchedule } from './entities/trip-schedule.entity';
import { CreateScheduleDto, GenerateTripsDto } from './dto/schedule.dto';
import { AppException } from '../../../common/errors/app-exception';
import { isScheduledOn, isSeasonActive, validateDaysOfWeek, validateSeason } from '../../../common/logic/schedule.util';
import { TripsService } from '../trips/trips.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Operator trip schedules. Trip generation delegates to TripsService (single home). */
@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(TripSchedule) private readonly repo: Repository<TripSchedule>,
    private readonly trips: TripsService,
  ) {}

  private guard(r: { ok: boolean; code?: string; message?: string }): void {
    if (!r.ok) throw new AppException(r.code ?? 'SCHEDULE_INVALID', r.message ?? 'Invalid schedule.', HttpStatus.BAD_REQUEST);
  }

  async create(operatorId: string, dto: CreateScheduleDto): Promise<TripSchedule> {
    this.guard(validateDaysOfWeek(dto.daysOfWeek));
    const recurrence = (dto.recurrence as 'WEEKLY' | 'SEASONAL') ?? 'WEEKLY';
    if (recurrence === 'SEASONAL') {
      if (!dto.seasonStart || !dto.seasonEnd) throw new AppException('SCHEDULE_SEASON_REQUIRED', 'Seasonal schedules need a start and end date.', HttpStatus.BAD_REQUEST);
      this.guard(validateSeason(Date.parse(dto.seasonStart), Date.parse(dto.seasonEnd)));
    }
    return this.repo.save(this.repo.create({
      operatorId, name: dto.name, routeId: dto.routeId, busId: dto.busId,
      departureTime: dto.departureTime, daysOfWeek: dto.daysOfWeek, recurrence,
      seasonStart: dto.seasonStart ?? null, seasonEnd: dto.seasonEnd ?? null,
      fareMultiplier: dto.fareMultiplier ?? 1,
    }));
  }

  listByOperator(operatorId: string): Promise<TripSchedule[]> {
    return this.repo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  private async requireOwned(operatorId: string, id: string): Promise<TripSchedule> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new AppException('SCHEDULE_NOT_FOUND', 'Schedule not found.', HttpStatus.NOT_FOUND);
    if (s.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This schedule does not belong to your operator.', HttpStatus.FORBIDDEN);
    return s;
  }

  async setActive(operatorId: string, id: string, active: boolean): Promise<TripSchedule> {
    const s = await this.requireOwned(operatorId, id);
    s.isActive = active;
    return this.repo.save(s);
  }

  /** Computes the dates in [from, to] on which this schedule would run. */
  private occurrenceDates(s: TripSchedule, fromMs: number, toMs: number): string[] {
    const dates: string[] = [];
    for (let t = fromMs; t <= toMs; t += MS_PER_DAY) {
      if (!isScheduledOn(s.daysOfWeek, t)) continue;
      if (s.recurrence === 'SEASONAL' && s.seasonStart && s.seasonEnd) {
        if (!isSeasonActive(Date.parse(s.seasonStart), Date.parse(s.seasonEnd), t)) continue;
      }
      dates.push(new Date(t).toISOString().slice(0, 10));
    }
    return dates;
  }

  async preview(operatorId: string, id: string, dto: GenerateTripsDto): Promise<{ scheduleId: string; dates: string[] }> {
    const s = await this.requireOwned(operatorId, id);
    return { scheduleId: id, dates: this.occurrenceDates(s, Date.parse(dto.fromDate), Date.parse(dto.toDate)) };
  }

  /** Generates trips for each occurrence by delegating to TripsService. */
  async generate(operatorId: string, id: string, dto: GenerateTripsDto): Promise<{ created: number; skipped: { date: string; reason: string }[] }> {
    const s = await this.requireOwned(operatorId, id);
    if (!s.isActive) throw new AppException('SCHEDULE_INACTIVE', 'This schedule is not active.', HttpStatus.BAD_REQUEST);
    const dates = this.occurrenceDates(s, Date.parse(dto.fromDate), Date.parse(dto.toDate));
    let created = 0;
    const skipped: { date: string; reason: string }[] = [];
    for (const date of dates) {
      try {
        await this.trips.create(operatorId, {
          busId: s.busId, routeId: s.routeId, departureDate: date,
          departureTime: s.departureTime, fareMultiplier: Number(s.fareMultiplier),
        });
        created += 1;
      } catch (e: any) {
        skipped.push({ date, reason: e?.code || e?.message || 'Could not create trip.' });
      }
    }
    return { created, skipped };
  }
}
