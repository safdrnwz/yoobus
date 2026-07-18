import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialPeriod, JournalEntry } from './entities/finance.entities';
import { PostJournalDto } from './dto/finance.dto';
import { AppException } from '../../../common/errors/app-exception';
import { canPostToPeriod, totalDebits, validateJournal } from '../../../common/logic/accounting.util';

/** Operator accounting: balanced double-entry journals within open financial periods. */
@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(JournalEntry) private readonly journalRepo: Repository<JournalEntry>,
    @InjectRepository(FinancialPeriod) private readonly periodRepo: Repository<FinancialPeriod>,
  ) {}

  private async period(operatorId: string, period: string): Promise<FinancialPeriod> {
    let p = await this.periodRepo.findOne({ where: { operatorId, period } });
    if (!p) p = await this.periodRepo.save(this.periodRepo.create({ operatorId, period, closed: false }));
    return p;
  }

  async postJournal(operatorId: string, userId: string, dto: PostJournalDto): Promise<JournalEntry> {
    const valid = validateJournal(dto.lines);
    if (!valid.ok) throw new AppException(valid.code!, valid.message!, HttpStatus.BAD_REQUEST);
    const p = await this.period(operatorId, dto.period);
    const postable = canPostToPeriod(p.closed);
    if (!postable.ok) throw new AppException(postable.code!, postable.message!, HttpStatus.BAD_REQUEST);
    return this.journalRepo.save(this.journalRepo.create({
      operatorId, period: dto.period, narration: dto.narration, lines: dto.lines,
      total: totalDebits(dto.lines), postedBy: userId,
    }));
  }

  listJournal(operatorId: string, period?: string): Promise<JournalEntry[]> {
    const where = period ? { operatorId, period } : { operatorId };
    return this.journalRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async closePeriod(operatorId: string, period: string): Promise<FinancialPeriod> {
    const p = await this.period(operatorId, period);
    p.closed = true;
    return this.periodRepo.save(p);
  }
  async reopenPeriod(operatorId: string, period: string): Promise<FinancialPeriod> {
    const p = await this.period(operatorId, period);
    p.closed = false;
    return this.periodRepo.save(p);
  }
  listPeriods(operatorId: string): Promise<FinancialPeriod[]> {
    return this.periodRepo.find({ where: { operatorId }, order: { period: 'DESC' } });
  }

  /** Trial balance: net debit/credit per account across posted journals. */
  async trialBalance(operatorId: string, period?: string) {
    const entries = await this.listJournal(operatorId, period);
    const accounts: Record<string, { debit: number; credit: number }> = {};
    for (const e of entries) {
      for (const l of e.lines) {
        accounts[l.account] = accounts[l.account] ?? { debit: 0, credit: 0 };
        accounts[l.account].debit += l.debit || 0;
        accounts[l.account].credit += l.credit || 0;
      }
    }
    const rows = Object.entries(accounts).map(([account, v]) => ({
      account, debit: Math.round(v.debit * 100) / 100, credit: Math.round(v.credit * 100) / 100,
    }));
    return { period: period ?? 'ALL', rows };
  }
}
