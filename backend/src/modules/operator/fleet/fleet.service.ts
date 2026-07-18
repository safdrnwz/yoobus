import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartInventory, VehicleDocument, WorkOrder } from './entities/fleet.entities';
import { CloseWorkOrderDto, CreateWorkOrderDto, PartDto, UpdateVehicleDocDto, VehicleDocDto, VerifyVehicleDocDto } from './dto/fleet.dto';
import { AppException } from '../../../common/errors/app-exception';
import { workOrderCanTransition, WorkOrderStatus } from '../../../common/logic/work-order.util';
import { daysToExpiry, isExpired, isExpiringSoon } from '../../../common/logic/expiry.util';
import { BusDocType, computeBusCompliance, DOC_TYPE_CONFIG, expiryAlertLevel } from '../../../common/logic/bus-document.util';
import { Bus } from '../../operator/buses/entities/bus.entity';

/** Operator fleet maintenance: work orders, vehicle documents, parts inventory. */
@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(WorkOrder) private readonly woRepo: Repository<WorkOrder>,
    @InjectRepository(VehicleDocument) private readonly docRepo: Repository<VehicleDocument>,
    @InjectRepository(PartInventory) private readonly partRepo: Repository<PartInventory>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
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

  // Vehicle documents (Bus Master spec §8.F)
  async addVehicleDoc(operatorId: string, dto: VehicleDocDto): Promise<VehicleDocument> {
    const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
    if (!bus || bus.operatorId !== operatorId) throw new AppException('BUS_NOT_FOUND', 'Bus not found for your operator.', HttpStatus.NOT_FOUND);
    // Spec §8.F — expiryDate is mandatory only where the document type requires it.
    const cfg = DOC_TYPE_CONFIG[dto.docType as BusDocType];
    if (cfg?.expiryRequired && !dto.expiresAt) {
      throw new AppException('EXPIRY_REQUIRED', `expiresAt is required for document type ${dto.docType}.`, HttpStatus.BAD_REQUEST);
    }
    return this.docRepo.save(this.docRepo.create({
      operatorId, busId: dto.busId, docType: dto.docType, documentNumber: dto.documentNumber,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      issuingAuthority: dto.issuingAuthority ?? null,
      remarks: dto.remarks ?? null,
      documentStatus: 'ACTIVE', verificationStatus: 'PENDING',
    }));
  }

  private async requireDoc(operatorId: string, id: string): Promise<VehicleDocument> {
    const d = await this.docRepo.findOne({ where: { id } });
    if (!d || d.operatorId !== operatorId) throw new AppException('DOC_NOT_FOUND', 'Document not found.', HttpStatus.NOT_FOUND);
    return d;
  }

  async updateVehicleDoc(operatorId: string, id: string, dto: UpdateVehicleDocDto): Promise<VehicleDocument> {
    const d = await this.requireDoc(operatorId, id);
    if (dto.documentNumber !== undefined) d.documentNumber = dto.documentNumber;
    if (dto.expiresAt !== undefined) d.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.issueDate !== undefined) d.issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    if (dto.issuingAuthority !== undefined) d.issuingAuthority = dto.issuingAuthority;
    if (dto.documentStatus !== undefined) d.documentStatus = dto.documentStatus;
    if (dto.remarks !== undefined) d.remarks = dto.remarks;
    const cfg = DOC_TYPE_CONFIG[d.docType as BusDocType];
    if (cfg?.expiryRequired && !d.expiresAt) {
      throw new AppException('EXPIRY_REQUIRED', `expiresAt is required for document type ${d.docType}.`, HttpStatus.BAD_REQUEST);
    }
    return this.docRepo.save(d);
  }

  /** Spec §8.F verificationStatus — PENDING → VERIFIED / REJECTED, with audit. */
  async verifyVehicleDoc(operatorId: string, id: string, verifierId: string, dto: VerifyVehicleDocDto): Promise<VehicleDocument> {
    const d = await this.requireDoc(operatorId, id);
    d.verificationStatus = dto.decision;
    d.verifiedBy = verifierId;
    d.verifiedAt = new Date();
    if (dto.remarks !== undefined) d.remarks = dto.remarks;
    return this.docRepo.save(d);
  }

  /** Attach the uploaded file (CDN url) to a document — spec §16.10. */
  async attachDocFile(operatorId: string, id: string, fileUrl: string, fileName: string): Promise<VehicleDocument> {
    const d = await this.requireDoc(operatorId, id);
    d.documentFileUrl = fileUrl;
    d.documentFileName = fileName;
    return this.docRepo.save(d);
  }

  /** All documents of a bus, each graded with its expiry alert level (spec §9.G). */
  async listBusDocs(operatorId: string, busId: string) {
    const now = Date.now();
    const docs = await this.docRepo.find({ where: { operatorId, busId }, order: { createdAt: 'DESC' } });
    return docs.map((d) => ({ ...d, alertLevel: expiryAlertLevel(d.expiresAt ? d.expiresAt.getTime() : null, now) }));
  }

  /**
   * Spec §14.L — overall bus compliance from documents + operational status.
   * A NON-ACTIVE bus can never be COMPLIANT for service.
   */
  async busCompliance(operatorId: string, busId: string) {
    const bus = await this.busRepo.findOne({ where: { id: busId } });
    if (!bus || bus.operatorId !== operatorId) throw new AppException('BUS_NOT_FOUND', 'Bus not found for your operator.', HttpStatus.NOT_FOUND);
    const docs = await this.docRepo.find({ where: { operatorId, busId } });
    const result = computeBusCompliance(
      docs.map((d) => ({ docType: d.docType, documentStatus: d.documentStatus, expiresAt: d.expiresAt ? d.expiresAt.getTime() : null })),
      Date.now(),
    );
    const operational = bus.busStatus ?? (bus.isActive ? 'ACTIVE' : 'INACTIVE');
    const status = operational === 'ACTIVE' ? result.status : (result.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'NON_COMPLIANT');
    return { busId, busStatus: operational, ...result, status };
  }
  async expiringVehicleDocs(operatorId: string, warningDays = 30) {
    const now = Date.now();
    const docs = (await this.docRepo.find({ where: { operatorId } })).filter((d) => d.expiresAt != null);
    return docs
      .map((d) => ({
        id: d.id, busId: d.busId, docType: d.docType, documentNumber: d.documentNumber,
        expiresAt: d.expiresAt, daysLeft: daysToExpiry(d.expiresAt!.getTime(), now),
        alertLevel: expiryAlertLevel(d.expiresAt!.getTime(), now),
        expired: isExpired(d.expiresAt!.getTime(), now), expiringSoon: isExpiringSoon(d.expiresAt!.getTime(), now, warningDays),
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
