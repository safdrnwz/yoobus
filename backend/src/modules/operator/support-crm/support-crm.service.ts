import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, LostFoundCase, PassengerFlag, SupportTicket } from './entities/support.entities';
import { BlacklistDto, CreateComplaintDto, CreateTicketDto, LostFoundDto } from './dto/support.dto';
import { AppException } from '../../../common/errors/app-exception';
import { ticketCanTransition, TicketStatus } from '../../../common/logic/support-crm.util';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { Logger } from '@nestjs/common';

/** Operator support & CRM: tickets, complaints, lost & found, passenger blacklist. */
@Injectable()
export class SupportCrmService {
  constructor(
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Complaint) private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(LostFoundCase) private readonly lostRepo: Repository<LostFoundCase>,
    @InjectRepository(PassengerFlag) private readonly flagRepo: Repository<PassengerFlag>,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  private readonly logger = new Logger('SupportCrm');
  private async notify(userId: string, template: string, vars: Record<string, any>) {
    try {
      const u = await this.users.findById(userId);
      if (u?.email) await this.email.send({ to: u.email, template, vars: { name: u.fullName, operatorName: 'Yoo Bus', ...vars }, operatorId: null });
    } catch (e) { this.logger.error(`Email ${template} failed: ${(e as Error).message}`); }
  }

  // Tickets
  async createTicket(operatorId: string, userId: string, dto: CreateTicketDto): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.save(this.ticketRepo.create({ operatorId, raisedByUserId: userId, subject: dto.subject, description: dto.description ?? null, status: 'OPEN' }));
    await this.notify(userId, 'SUPPORT_TICKET_CREATED', { ticketId: ticket.id.slice(0, 8).toUpperCase(), subject: ticket.subject });
    return ticket;
  }
  listTickets(operatorId: string): Promise<SupportTicket[]> {
    return this.ticketRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
  async transitionTicket(operatorId: string, id: string, to: TicketStatus, assigneeId?: string): Promise<SupportTicket> {
    const t = await this.ticketRepo.findOne({ where: { id } });
    if (!t || t.operatorId !== operatorId) throw new AppException('TICKET_NOT_FOUND', 'Support ticket not found.', HttpStatus.NOT_FOUND);
    const guard = ticketCanTransition(t.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    t.status = to;
    if (assigneeId !== undefined) t.assigneeId = assigneeId;
    const saved = await this.ticketRepo.save(t);
    if (to === 'RESOLVED' && t.raisedByUserId) await this.notify(t.raisedByUserId, 'SUPPORT_TICKET_RESOLVED', { ticketId: t.id.slice(0, 8).toUpperCase(), resolution: 'Your issue has been resolved by our support team.' });
    return saved;
  }

  // Complaints
  createComplaint(operatorId: string, dto: CreateComplaintDto): Promise<Complaint> {
    return this.complaintRepo.save(this.complaintRepo.create({ operatorId, customerUserId: dto.customerUserId ?? null, subject: dto.subject, status: 'OPEN' }));
  }
  listComplaints(operatorId: string): Promise<Complaint[]> {
    return this.complaintRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
  async transitionComplaint(operatorId: string, id: string, to: TicketStatus): Promise<Complaint> {
    const c = await this.complaintRepo.findOne({ where: { id } });
    if (!c || c.operatorId !== operatorId) throw new AppException('COMPLAINT_NOT_FOUND', 'Complaint not found.', HttpStatus.NOT_FOUND);
    const guard = ticketCanTransition(c.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    c.status = to;
    return this.complaintRepo.save(c);
  }

  // Lost & found
  createLostFound(operatorId: string, dto: LostFoundDto): Promise<LostFoundCase> {
    return this.lostRepo.save(this.lostRepo.create({ operatorId, itemDescription: dto.itemDescription, tripId: dto.tripId ?? null, status: 'OPEN' }));
  }
  listLostFound(operatorId: string): Promise<LostFoundCase[]> {
    return this.lostRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
  async closeLostFound(operatorId: string, id: string): Promise<LostFoundCase> {
    const c = await this.lostRepo.findOne({ where: { id } });
    if (!c || c.operatorId !== operatorId) throw new AppException('LOST_FOUND_NOT_FOUND', 'Lost & found case not found.', HttpStatus.NOT_FOUND);
    c.status = 'CLOSED';
    return this.lostRepo.save(c);
  }

  // Passenger blacklist
  async setBlacklist(operatorId: string, dto: BlacklistDto): Promise<PassengerFlag> {
    let f = await this.flagRepo.findOne({ where: { operatorId, customerUserId: dto.customerUserId } });
    if (f) { f.blacklisted = dto.blacklisted; f.reason = dto.reason ?? null; }
    else f = this.flagRepo.create({ operatorId, customerUserId: dto.customerUserId, blacklisted: dto.blacklisted, reason: dto.reason ?? null });
    return this.flagRepo.save(f);
  }
  listBlacklist(operatorId: string): Promise<PassengerFlag[]> {
    return this.flagRepo.find({ where: { operatorId, blacklisted: true }, order: { updatedAt: 'DESC' } });
  }
}
