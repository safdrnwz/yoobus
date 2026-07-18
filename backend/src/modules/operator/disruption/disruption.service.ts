import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisruptionEvent } from './entities/disruption-event.entity';
import { BackupDto, DeclareDisruptionDto, DivertDto, RcaDto } from './dto/disruption.dto';
import { AppException } from '../../../common/errors/app-exception';
import { disruptionCanTransition, DisruptionStatus, isMajorIncident, Severity } from '../../../common/logic/disruption.util';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { User } from '../../customer/users/entities/user.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { EmailService } from '../../integrations/email/email.service';

/** Operator control tower: declare disruptions, mitigate (divert/backup), resolve, RCA. */
@Injectable()
export class DisruptionService {
  constructor(
    @InjectRepository(DisruptionEvent) private readonly repo: Repository<DisruptionEvent>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async declare(operatorId: string, dto: DeclareDisruptionDto): Promise<DisruptionEvent> {
    const event = await this.repo.save(this.repo.create({
      operatorId, type: dto.type, severity: dto.severity as Severity, description: dto.description,
      tripId: dto.tripId ?? null, status: 'OPEN', majorIncident: isMajorIncident(dto.severity as Severity),
    }));
    // Notify every affected passenger on the disrupted trip.
    if (dto.tripId) {
      try {
        const affected = await this.bookingRepo.find({ where: { tripId: dto.tripId, status: BookingStatus.CONFIRMED } });
        for (const b of affected) {
          const u = await this.userRepo.findOne({ where: { id: b.userId } });
          if (u?.email) await this.email.send({ to: u.email, template: 'TRIP_DISRUPTION', vars: { name: u.fullName, pnr: b.pnr, message: dto.description, action: 'Our team is actively managing this. We will keep you posted.', operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: null });
        }
      } catch (e) { this.logger.error(`Disruption notifications failed: ${(e as Error).message}`); }
    }
    return event;
  }
  private readonly logger = new Logger('Disruption');

  list(operatorId: string): Promise<DisruptionEvent[]> {
    return this.repo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  private async require(operatorId: string, id: string): Promise<DisruptionEvent> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e || e.operatorId !== operatorId) throw new AppException('DISRUPTION_NOT_FOUND', 'Disruption not found.', HttpStatus.NOT_FOUND);
    return e;
  }

  private async transition(operatorId: string, id: string, to: DisruptionStatus): Promise<DisruptionEvent> {
    const e = await this.require(operatorId, id);
    const guard = disruptionCanTransition(e.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    e.status = to;
    return this.repo.save(e);
  }

  async divert(operatorId: string, id: string, dto: DivertDto): Promise<DisruptionEvent> {
    const e = await this.require(operatorId, id);
    if (e.status === 'CLOSED' || e.status === 'RESOLVED') throw new AppException('DISRUPTION_NOT_ACTIVE', 'This disruption is no longer active.', HttpStatus.BAD_REQUEST);
    e.divertedToRouteId = dto.divertedToRouteId;
    e.status = 'MITIGATING';
    return this.repo.save(e);
  }
  async deployBackup(operatorId: string, id: string, dto: BackupDto): Promise<DisruptionEvent> {
    const e = await this.require(operatorId, id);
    if (e.status === 'CLOSED' || e.status === 'RESOLVED') throw new AppException('DISRUPTION_NOT_ACTIVE', 'This disruption is no longer active.', HttpStatus.BAD_REQUEST);
    e.backupBusId = dto.backupBusId;
    e.status = 'MITIGATING';
    return this.repo.save(e);
  }
  resolve(operatorId: string, id: string): Promise<DisruptionEvent> { return this.transition(operatorId, id, 'RESOLVED'); }
  close(operatorId: string, id: string): Promise<DisruptionEvent> { return this.transition(operatorId, id, 'CLOSED'); }

  async recordRca(operatorId: string, id: string, dto: RcaDto): Promise<DisruptionEvent> {
    const e = await this.require(operatorId, id);
    e.rootCause = dto.rootCause;
    return this.repo.save(e);
  }
}
