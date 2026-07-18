import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { BusesService } from '../../operator/buses/buses.service';
import { DriversService } from '../../operator/drivers/drivers.service';
import { RoutesService } from '../../operator/routes/routes.service';
import { TripsService } from '../../operator/trips/trips.service';
import { BookingsService } from '../../booking/bookings/bookings.service';
import { BillingService } from '../../finance/billing/billing.service';
import { SettlementsService } from '../../finance/settlements/settlements.service';
import { FinanceSummaryService } from '../../finance/summary/summary.service';
import { AppException } from '../../../common/errors/app-exception';
import { canDelete, ResourceType } from '../../../common/logic/delete-permission.util';

/**
 * Platform-only (SuperAdmin) cross-operator administration.
 *
 * This service holds NO duplicate data-access or business logic. Every read and every
 * delete delegates to the resource's own domain service (the single home for that
 * functionality); the admin layer only widens the scope to any operator and is guarded
 * by @Roles(SUPERADMIN). Operator-level governance (update, soft-delete) is the one
 * responsibility that genuinely lives here and nowhere else.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
    private readonly buses: BusesService,
    private readonly drivers: DriversService,
    private readonly routes: RoutesService,
    private readonly trips: TripsService,
    private readonly bookings: BookingsService,
    private readonly billing: BillingService,
    private readonly settlements: SettlementsService,
    private readonly financeSummary: FinanceSummaryService,
  ) {}

  private async ensureOperator(operatorId: string): Promise<Operator> {
    const op = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!op) throw new AppException('OPERATOR_NOT_FOUND', 'Operator not found', HttpStatus.NOT_FOUND);
    return op;
  }

  // ---- Cross-operator reads (delegated to the single domain service) ----
  busesOf(operatorId: string) {
    return this.buses.listByOperator(operatorId);
  }
  driversOf(operatorId: string) {
    return this.drivers.listByOperator(operatorId);
  }
  routesOf(operatorId: string) {
    return this.routes.listByOperator(operatorId);
  }
  tripsOf(operatorId: string) {
    return this.trips.listByOperator(operatorId);
  }
  bookingsOf(operatorId: string) {
    return this.bookings.listByOperator(operatorId);
  }

  async billingOf(operatorId: string) {
    const op = await this.ensureOperator(operatorId);
    const [invoices, commission, settlements, summary] = await Promise.all([
      this.billing.listInvoices(operatorId),
      this.billing.commissionSummary(operatorId),
      this.settlements.list(operatorId),
      this.financeSummary.operatorSummary(operatorId),
    ]);
    // This operator's own commercial terms (SuperAdmin-set; different for every operator).
    const billingConfig = {
      commissionRate: Number(op.commissionRate),
      oneTimePlatformFee: Number(op.oneTimePlatformFee),
      setupFeePerBus: Number(op.setupFeePerBus),
      smsCharge: Number(op.smsCharge),
      whatsappCharge: Number(op.whatsappCharge),
      emailCharge: Number(op.emailCharge),
      extraCharges: op.extraCharges ?? {},
    };
    return { operatorId, billingConfig, invoices, settlements, commission, summary };
  }

  // Government records export — includes soft-deleted rows (delegated with includeDeleted).
  async recordsExport(operatorId: string) {
    const op = await this.ensureOperator(operatorId);
    const [buses, drivers, routes, trips, bookings, invoices, ledger, settlements] = await Promise.all([
      this.buses.listByOperator(operatorId, true),
      this.drivers.listByOperator(operatorId, true),
      this.routes.listByOperator(operatorId, true),
      this.trips.listByOperator(operatorId, true),
      this.bookings.listByOperator(operatorId, true),
      this.billing.listInvoices(operatorId),
      this.billing.ledgerOf(operatorId),
      this.settlements.list(operatorId),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      operator: { id: op.id, legalName: op.legalName, gstin: op.gstin, pan: op.pan },
      counts: {
        buses: buses.length, drivers: drivers.length, routes: routes.length,
        trips: trips.length, bookings: bookings.length, invoices: invoices.length, settlements: settlements.length,
      },
      buses, drivers, routes, trips, bookings, invoices, ledger, settlements,
      note: 'Includes soft-deleted records. Retain per GST (6y) and Companies Act (8y); extend during litigation.',
    };
  }

  // ---- Operator-level governance (lives only here) ----
  async updateOperator(operatorId: string, patch: Partial<Operator> & { isActive?: boolean }) {
    const op = await this.ensureOperator(operatorId);
    if (patch.commissionRate !== undefined) {
      const rate = Number(patch.commissionRate);
      if (Number.isNaN(rate) || rate < 0 || rate > 1) {
        throw new AppException('INVALID_COMMISSION_RATE', 'Commission rate must be a number between 0 and 1 (0% to 100%).', HttpStatus.BAD_REQUEST);
      }
    }
    // `isActive` is a UI convenience: the entity has no such column, it maps to `status`.
    // Without this it was silently dropped and activate/suspend from the admin panel did nothing.
    if (patch.isActive !== undefined) {
      op.status = patch.isActive ? OperatorStatus.ACTIVE : OperatorStatus.SUSPENDED;
      delete patch.isActive;
    }
    Object.assign(op, patch);
    return this.operatorRepo.save(op);
  }

  private assertDeletable(role: string, resource: ResourceType) {
    const res = canDelete(role, resource);
    if (!res.ok) throw new AppException(res.code!, `Delete not allowed for ${resource}`, HttpStatus.FORBIDDEN);
  }

  async softDeleteOperator(role: string, operatorId: string) {
    this.assertDeletable(role, 'OPERATOR');
    const active = await this.trips.countScheduledForOperator(operatorId);
    if (active > 0) throw new AppException('OPERATOR_HAS_ACTIVE_TRIPS', 'Operator has active scheduled trips', HttpStatus.CONFLICT);
    await this.operatorRepo.softDelete(operatorId);
    return { operatorId, deleted: true };
  }

  // ---- Cross-operator resource deletes (delegated to the resource's own service) ----
  softDeleteBus(role: string, id: string) {
    return this.buses.adminSoftDelete(role, id);
  }
  softDeleteDriver(role: string, id: string) {
    return this.drivers.adminSoftDelete(role, id);
  }
  softDeleteRoute(role: string, id: string) {
    return this.routes.adminSoftDelete(role, id);
  }
}
