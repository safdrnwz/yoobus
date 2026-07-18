import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Agent, Counter, CounterSale } from './entities/counter.entities';
import { CreateAgentDto, CreateCounterDto, RecordSaleDto } from './dto/counter.dto';
import { BookingsService } from '../../booking/bookings/bookings.service';
import { AppException } from '../../../common/errors/app-exception';

const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;

/** Counter / agent operations: walk-in cash sales, attribution and daily closing. */
@Injectable()
export class CounterService {
  constructor(
    @InjectRepository(Counter) private readonly counterRepo: Repository<Counter>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(CounterSale) private readonly saleRepo: Repository<CounterSale>,
    private readonly bookings: BookingsService,
  ) {}

  async createCounter(operatorId: string, dto: CreateCounterDto) {
    return this.counterRepo.save(this.counterRepo.create({ operatorId, name: dto.name, location: dto.location ?? null, active: true }));
  }
  listCounters(operatorId: string) { return this.counterRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } }); }

  createAgent(operatorId: string, dto: CreateAgentDto) {
    return this.agentRepo.save(this.agentRepo.create({ operatorId, name: dto.name, counterId: dto.counterId ?? null, phone: dto.phone ?? null, active: true }));
  }
  listAgents(operatorId: string) { return this.agentRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } }); }

  /** Record a walk-in payment: confirms the (PENDING) booking as paid and logs the counter sale. */
  async recordSale(operatorId: string, dto: RecordSaleDto) {
    const counter = await this.counterRepo.findOne({ where: { id: dto.counterId } });
    if (!counter || counter.operatorId !== operatorId) throw new AppException('COUNTER_NOT_FOUND', 'Counter not found', HttpStatus.NOT_FOUND);
    const agent = await this.agentRepo.findOne({ where: { id: dto.agentId } });
    if (!agent || agent.operatorId !== operatorId) throw new AppException('AGENT_NOT_FOUND', 'Agent not found', HttpStatus.NOT_FOUND);
    const booking = await this.bookings.findById(dto.bookingId);
    if (booking.operatorId !== operatorId) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found for this operator', HttpStatus.NOT_FOUND);

    // Cash/UPI/card received at the counter → confirm the booking.
    await this.bookings.confirmPayment(dto.bookingId);
    const sale = await this.saleRepo.save(this.saleRepo.create({
      operatorId, counterId: dto.counterId, agentId: dto.agentId, bookingId: dto.bookingId,
      amount: dto.amount, paymentMode: dto.paymentMode,
    }));
    return { saleId: sale.id, bookingId: dto.bookingId, confirmed: true };
  }

  /** Daily closing for a counter: totals for the given date (YYYY-MM-DD, defaults to today). */
  async dailyClosing(operatorId: string, counterId: string, date?: string) {
    const counter = await this.counterRepo.findOne({ where: { id: counterId } });
    if (!counter || counter.operatorId !== operatorId) throw new AppException('COUNTER_NOT_FOUND', 'Counter not found', HttpStatus.NOT_FOUND);
    const d = date ? new Date(date + 'T00:00:00') : new Date(new Date().toDateString());
    const end = new Date(d); end.setDate(end.getDate() + 1);
    const sales = await this.saleRepo.find({ where: { counterId, createdAt: Between(d, end) } });
    const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
    let total = 0;
    for (const s of sales) { byMode[s.paymentMode] = money((byMode[s.paymentMode] || 0) + Number(s.amount)); total = money(total + Number(s.amount)); }
    return { counter: counter.name, date: d.toISOString().slice(0, 10), totalSales: sales.length, totalCollected: total, byMode };
  }
}
