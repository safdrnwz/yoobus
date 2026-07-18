import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicePayment } from './entities/invoice-payment.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { GenerateInvoiceDto, NoteDto, RecordPaymentDto } from './dto/billing.dto';
import { AppException } from '../../../common/errors/app-exception';
import {
  canApplyCreditNote, canApplyDebitNote, canRecordPayment, canVoidInvoice, computeGstSplit,
  computeSubtotal, formatInvoiceNumber, statusAfterPayment, stateCodeFromGstin,
} from '../../../common/logic/billing.util';
import { DEFAULT_SUPPLIER_STATE_CODE, DEFAULT_GST_RATE } from '../../../common/config/platform-defaults';


/** SuperAdmin billing: invoices, GST, payments, credit and debit notes. */
@Injectable()
export class SaasBillingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoicePayment) private readonly paymentRepo: Repository<InvoicePayment>,
    @InjectRepository(CreditNote) private readonly creditRepo: Repository<CreditNote>,
    @InjectRepository(DebitNote) private readonly debitRepo: Repository<DebitNote>,
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
  ) {}

  private guard(result: { ok: boolean; code?: string; message?: string }): void {
    if (!result.ok) throw new AppException(result.code ?? 'BILLING_INVALID', result.message ?? 'Invalid billing request.', HttpStatus.BAD_REQUEST);
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const countThisYear = await this.invoiceRepo.count({ where: { createdAt: Between(start, end) } });
    return formatInvoiceNumber('INV', year, countThisYear + 1);
  }

  async generate(dto: GenerateInvoiceDto): Promise<Invoice> {
    const operator = await this.operatorRepo.findOne({ where: { id: dto.operatorId } });
    if (!operator) throw new AppException('OPERATOR_NOT_FOUND', 'Operator (operator) not found.', HttpStatus.NOT_FOUND);

    const customerState = dto.customerStateCode ?? (dto.customerGstin ? stateCodeFromGstin(dto.customerGstin) : DEFAULT_SUPPLIER_STATE_CODE);
    const gstRate = dto.gstRate ?? DEFAULT_GST_RATE;
    const subtotal = computeSubtotal(dto.items);
    const gst = computeGstSplit(subtotal, gstRate, DEFAULT_SUPPLIER_STATE_CODE, customerState);
    const now = new Date();

    const invoice = this.invoiceRepo.create({
      invoiceNumber: await this.nextInvoiceNumber(),
      operatorId: dto.operatorId,
      kind: 'INVOICE',
      status: 'ISSUED',
      customerGstin: dto.customerGstin ?? null,
      supplierStateCode: DEFAULT_SUPPLIER_STATE_CODE,
      customerStateCode: customerState,
      lineItems: dto.items,
      subtotal,
      gstRate,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      total: gst.total,
      amountPaid: 0,
      issuedAt: now,
      dueDate: dto.dueDays ? new Date(now.getTime() + dto.dueDays * 86400000) : null,
    });
    return this.invoiceRepo.save(invoice);
  }

  list(operatorId?: string): Promise<Invoice[]> {
    const where = operatorId ? { operatorId } : {};
    return this.invoiceRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new AppException('INVOICE_NOT_FOUND', 'Invoice not found.', HttpStatus.NOT_FOUND);
    return invoice;
  }

  async voidInvoice(id: string): Promise<Invoice> {
    const invoice = await this.get(id);
    this.guard(canVoidInvoice(invoice.status));
    invoice.status = 'VOID';
    return this.invoiceRepo.save(invoice);
  }

  async recordPayment(id: string, dto: RecordPaymentDto): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
    const invoice = await this.get(id);
    this.guard(canRecordPayment(invoice.status));
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({ invoiceId: id, amount: dto.amount, method: dto.method, reference: dto.reference ?? null }),
    );
    invoice.amountPaid = Math.round((Number(invoice.amountPaid) + dto.amount) * 100) / 100;
    invoice.status = statusAfterPayment(Number(invoice.total), Number(invoice.amountPaid) - dto.amount, dto.amount);
    const saved = await this.invoiceRepo.save(invoice);
    return { invoice: saved, payment };
  }

  async createCreditNote(id: string, dto: NoteDto): Promise<CreditNote> {
    const invoice = await this.get(id);
    const existing = await this.creditRepo.find({ where: { invoiceId: id } });
    const alreadyCredited = existing.reduce((s, n) => s + Number(n.amount), 0);
    this.guard(canApplyCreditNote(Number(invoice.total), alreadyCredited, dto.amount));
    const year = new Date().getFullYear();
    const count = await this.creditRepo.count();
    return this.creditRepo.save(
      this.creditRepo.create({ invoiceId: id, operatorId: invoice.operatorId, noteNumber: formatInvoiceNumber('CRN', year, count + 1), amount: dto.amount, reason: dto.reason }),
    );
  }

  async createDebitNote(id: string, dto: NoteDto): Promise<DebitNote> {
    const invoice = await this.get(id);
    this.guard(canApplyDebitNote(invoice.status, dto.amount));
    const year = new Date().getFullYear();
    const count = await this.debitRepo.count();
    return this.debitRepo.save(
      this.debitRepo.create({ invoiceId: id, operatorId: invoice.operatorId, noteNumber: formatInvoiceNumber('DBN', year, count + 1), amount: dto.amount, reason: dto.reason }),
    );
  }

  async notesFor(id: string): Promise<{ credits: CreditNote[]; debits: DebitNote[]; payments: InvoicePayment[] }> {
    const [credits, debits, payments] = await Promise.all([
      this.creditRepo.find({ where: { invoiceId: id } }),
      this.debitRepo.find({ where: { invoiceId: id } }),
      this.paymentRepo.find({ where: { invoiceId: id } }),
    ]);
    return { credits, debits, payments };
  }
}
