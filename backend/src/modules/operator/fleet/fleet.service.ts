import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartInventory, VehicleDocument, WorkOrder } from './entities/fleet.entities';
import { CloseWorkOrderDto, CreateWorkOrderDto, PartDto, VehicleDocDto } from './dto/fleet.dto';
import { AppException } from '../../../common/errors/app-exception';
import { workOrderCanTransition, WorkOrderStatus } from '../../../common/logic/work-order.util';
import { daysToExpiry, isExpired, isExpiringSoon } from '../../../common/logic/expiry.util';

/** Operator fleet maintenance: work orders, vehicle documents, parts inventory. */
@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(WorkOrder) private readonly woRepo: Repository<WorkOrder>,
    @InjectRepository(VehicleDocument) private readonly docRepo: Repository<VehicleDocument>,
    @InjectRepository(PartInventory) private readonly partRepo: Repository<PartInventory>,
  ) {}

  // Work orders
  createWorkOrder(operatorId: string, dto: CreateWorkOrderDto): Promise<WorkOrder> {
    return this.woRepo.save(this.woRepo.create({ operatorId, busId: dto.busId, title: dto.title, description: dto.description ?? null, status: 'OPEN' }));
  }
  listWorkOrders(operatorId: string): Promise<WorkOrder[]> {
    return this.woRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
  async transitionWorkOrder(operatorId: string, id: string, to: WorkOrderStatus, dto?: CloseWorkOrderDto): Promise<WorkOrder> {
    const wo = await this.woRepo.findOne({ where: { id } });
    if (!wo || wo.operatorId !== operatorId) throw new AppException('WORK_ORDER_NOT_FOUND', 'Work order not found.', HttpStatus.NOT_FOUND);
    const guard = workOrderCanTransition(wo.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    wo.status = to;
    if (to === 'CLOSED') { wo.closedAt = new Date(); if (dto?.cost != null) wo.cost = dto.cost; }
    return this.woRepo.save(wo);
  }

  // Vehicle documents
  addVehicleDoc(operatorId: string, dto: VehicleDocDto): Promise<VehicleDocument> {
    return this.docRepo.save(this.docRepo.create({ operatorId, busId: dto.busId, docType: dto.docType as any, documentNumber: dto.documentNumber, expiresAt: new Date(dto.expiresAt) }));
  }
  async expiringVehicleDocs(operatorId: string, warningDays = 30) {
    const now = Date.now();
    const docs = await this.docRepo.find({ where: { operatorId } });
    return docs
      .map((d) => ({
        id: d.id, busId: d.busId, docType: d.docType, documentNumber: d.documentNumber,
        expiresAt: d.expiresAt, daysLeft: daysToExpiry(d.expiresAt.getTime(), now),
        expired: isExpired(d.expiresAt.getTime(), now), expiringSoon: isExpiringSoon(d.expiresAt.getTime(), now, warningDays),
      }))
      .filter((d) => d.expired || d.expiringSoon)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  // Parts inventory
  async upsertPart(operatorId: string, dto: PartDto): Promise<PartInventory> {
    let part = await this.partRepo.findOne({ where: { operatorId, partName: dto.partName } });
    if (part) part.quantity = dto.quantity;
    else part = this.partRepo.create({ operatorId, partName: dto.partName, quantity: dto.quantity });
    return this.partRepo.save(part);
  }
  listParts(operatorId: string): Promise<PartInventory[]> {
    return this.partRepo.find({ where: { operatorId }, order: { partName: 'ASC' } });
  }
}
