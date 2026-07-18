import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { CorporateAccount, CorporateEmployee } from './entities/corporate.entities';
import { AddEmployeeDto, CreateCorporateDto } from './dto/corporate.dto';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { User } from '../../customer/users/entities/user.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { AppException } from '../../../common/errors/app-exception';

const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;

/** Corporate B2B: manage company accounts, their employees, and monthly GST statements. */
@Injectable()
export class CorporateService {
  constructor(
    @InjectRepository(CorporateAccount) private readonly accRepo: Repository<CorporateAccount>,
    @InjectRepository(CorporateEmployee) private readonly empRepo: Repository<CorporateEmployee>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  create(dto: CreateCorporateDto): Promise<CorporateAccount> {
    return this.accRepo.save(this.accRepo.create({
      companyName: dto.companyName, adminEmail: dto.adminEmail, gstin: dto.gstin ?? null,
      creditLimit: dto.creditLimit ?? 0, status: 'ACTIVE', billingCycle: 'MONTHLY',
    }));
  }

  list(): Promise<CorporateAccount[]> { return this.accRepo.find({ order: { createdAt: 'DESC' } }); }

  private async require(id: string): Promise<CorporateAccount> {
    const acc = await this.accRepo.findOne({ where: { id } });
    if (!acc) throw new AppException('CORPORATE_NOT_FOUND', 'Corporate account not found', HttpStatus.NOT_FOUND);
    return acc;
  }

  async addEmployee(corporateId: string, dto: AddEmployeeDto): Promise<CorporateEmployee> {
    await this.require(corporateId);
    const existing = await this.empRepo.findOne({ where: { corporateId, email: dto.email } });
    if (existing) throw new AppException('EMPLOYEE_EXISTS', 'This employee is already on the account', HttpStatus.CONFLICT);
    return this.empRepo.save(this.empRepo.create({ corporateId, email: dto.email, fullName: dto.fullName, active: true }));
  }

  listEmployees(corporateId: string): Promise<CorporateEmployee[]> {
    return this.empRepo.find({ where: { corporateId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Monthly statement: aggregates confirmed bookings made by the account's employees
   * (matched by email) in the given month, with a GST-compliant total.
   * month format: 'YYYY-MM' (defaults to the current month).
   */
  async monthlyStatement(corporateId: string, month?: string) {
    const acc = await this.require(corporateId);
    const employees = await this.empRepo.find({ where: { corporateId } });
    const emails = employees.map((e) => e.email);
    if (!emails.length) return { corporate: acc.companyName, gstin: acc.gstin, month: month ?? '', lines: [], totals: { bookings: 0, base: 0, gst: 0, total: 0 } };

    const now = new Date();
    const m = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(`${m}-01T00:00:00`);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);

    const users = await this.userRepo.find({ where: { email: In(emails) } });
    const byId = new Map(users.map((u) => [u.id, u.email]));
    const bookings = users.length
      ? await this.bookingRepo.find({ where: { userId: In(users.map((u) => u.id)), status: BookingStatus.CONFIRMED, createdAt: Between(start, end) } })
      : [];

    const perEmployee = new Map<string, { bookings: number; base: number; gst: number; total: number }>();
    let tBase = 0, tGst = 0, tTotal = 0, tCount = 0;
    for (const b of bookings) {
      const email = byId.get(b.userId) ?? 'unknown';
      const row = perEmployee.get(email) ?? { bookings: 0, base: 0, gst: 0, total: 0 };
      row.bookings += 1; row.base = money(row.base + Number(b.baseFare)); row.gst = money(row.gst + Number(b.fareGst)); row.total = money(row.total + Number(b.payableByPassenger));
      perEmployee.set(email, row);
      tBase = money(tBase + Number(b.baseFare)); tGst = money(tGst + Number(b.fareGst)); tTotal = money(tTotal + Number(b.payableByPassenger)); tCount += 1;
    }
    return {
      corporate: acc.companyName, gstin: acc.gstin, month: m,
      lines: [...perEmployee.entries()].map(([email, v]) => ({ employee: email, ...v })),
      totals: { bookings: tCount, base: tBase, gst: tGst, total: tTotal },
      note: 'GST-compliant corporate statement. Amounts reflect confirmed bookings by registered employees.',
    };
  }
}
