import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SaasBillingService } from './saas-billing.service';
import { GenerateInvoiceDto, NoteDto, RecordPaymentDto } from './dto/billing.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

/** SuperAdmin-only SaaS billing endpoints. */
@Roles(Role.SUPERADMIN, Role.ACCOUNTANT)
@Controller('saas-billing')
export class SaasBillingController {
  constructor(private readonly billing: SaasBillingService) {}

  @RequirePermission('CREATE_SAAS_INVOICE') @Post('invoices') generate(@Body() dto: GenerateInvoiceDto) {
    return this.billing.generate(dto);
  }

  @RequirePermission('VIEW_SAAS_LEDGER') @Get('invoices') list(@Query('operatorId') operatorId?: string) {
    return this.billing.list(operatorId);
  }

  @RequirePermission('VIEW_SAAS_LEDGER') @Get('invoices/:id') get(@Param('id') id: string) {
    return this.billing.get(id);
  }

  @RequirePermission('VIEW_SAAS_LEDGER') @Get('invoices/:id/notes') notes(@Param('id') id: string) {
    return this.billing.notesFor(id);
  }

  @RequirePermission('VOID_SAAS_INVOICE') @Post('invoices/:id/void') voidInvoice(@Param('id') id: string) {
    return this.billing.voidInvoice(id);
  }

  @RequirePermission('RECORD_SAAS_PAYMENT') @Post('invoices/:id/payments') pay(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.billing.recordPayment(id, dto);
  }

  @RequirePermission('CREATE_SAAS_CREDIT_NOTE') @Post('invoices/:id/credit-notes') credit(@Param('id') id: string, @Body() dto: NoteDto) {
    return this.billing.createCreditNote(id, dto);
  }

  @RequirePermission('CREATE_SAAS_DEBIT_NOTE') @Post('invoices/:id/debit-notes') debit(@Param('id') id: string, @Body() dto: NoteDto) {
    return this.billing.createDebitNote(id, dto);
  }
}
