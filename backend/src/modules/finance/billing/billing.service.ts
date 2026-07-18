import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SetupInvoice } from './entities/setup-invoice.entity';
import { CommissionLedger } from './entities/commission-ledger.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(SetupInvoice) private readonly invoiceRepo: Repository<SetupInvoice>,
    @InjectRepository(CommissionLedger) private readonly ledgerRepo: Repository<CommissionLedger>,
  ) {}

  listInvoices(operatorId: string) { return this.invoiceRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } }); }

  /**
   * One-time platform (onboarding) fee invoice. Idempotent: at most one per operator
   * (busId IS NULL identifies it). Amount comes from the operator's own billing config.
   */
  async createPlatformFeeInvoice(operatorId: string, amount: number) {
    if (!amount || amount <= 0) return null;
    const existing = await this.invoiceRepo.findOne({ where: { operatorId, kind: 'PLATFORM_FEE' } });
    if (existing) return existing;
    const count = await this.invoiceRepo.count({ where: { kind: 'PLATFORM_FEE' } });
    const invoiceNumber = 'TB-PF-' + String(count + 1).padStart(6, '0');
    return this.invoiceRepo.save(this.invoiceRepo.create({
      operatorId, busId: null, kind: 'PLATFORM_FEE', invoiceNumber, amount, status: 'UNPAID',
    }));
  }
  ledgerOf(operatorId: string) { return this.ledgerRepo.find({ where: { operatorId } }); }

  // Net commission (CREDIT - DEBIT) per operator
  async commissionSummary(operatorId: string) {
    const rows = await this.ledgerRepo.find({ where: { operatorId } });
    let net = 0, gst = 0, tcs = 0, tds = 0;
    for (const r of rows) {
      const sign = r.entryType === 'CREDIT' ? 1 : -1;
      net += sign * Number(r.commissionBase);
      gst += sign * Number(r.commissionGst);
      tcs += sign * Number(r.tcs);
      tds += sign * Number(r.tds);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return { operatorId, netCommission: round(net), commissionGst: round(gst), tcs: round(tcs), tds: round(tds), entries: rows.length };
  }

  // Platform-wide (superadmin)
  async platformCommission() {
    const rows = await this.ledgerRepo.find();
    let net = 0;
    for (const r of rows) net += (r.entryType === 'CREDIT' ? 1 : -1) * Number(r.commissionBase);
    return { totalNetCommission: Math.round(net * 100) / 100, entries: rows.length };
  }
}
