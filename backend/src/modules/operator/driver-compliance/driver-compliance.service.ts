import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverDocument, DriverTraining, DriverViolation } from './entities/compliance.entities';
import { AddDocumentDto, TrainingDto, ViolationDto } from './dto/compliance.dto';
import { allValid, daysToExpiry, isExpired, isExpiringSoon } from '../../../common/logic/expiry.util';

/** Operator driver compliance: documents (with expiry tracking), violations, training. */
@Injectable()
export class DriverComplianceService {
  constructor(
    @InjectRepository(DriverDocument) private readonly docRepo: Repository<DriverDocument>,
    @InjectRepository(DriverViolation) private readonly violationRepo: Repository<DriverViolation>,
    @InjectRepository(DriverTraining) private readonly trainingRepo: Repository<DriverTraining>,
  ) {}

  addDocument(operatorId: string, dto: AddDocumentDto): Promise<DriverDocument> {
    return this.docRepo.save(this.docRepo.create({
      operatorId, driverId: dto.driverId, docType: dto.docType as any,
      documentNumber: dto.documentNumber, expiresAt: new Date(dto.expiresAt), fileKey: dto.fileKey ?? null,
    }));
  }

  documentsFor(operatorId: string, driverId: string): Promise<DriverDocument[]> {
    return this.docRepo.find({ where: { operatorId, driverId }, order: { expiresAt: 'ASC' } });
  }

  /** All documents for the operator that are expired or within the warning window. */
  async expiringDocuments(operatorId: string, warningDays = 30) {
    const now = Date.now();
    const docs = await this.docRepo.find({ where: { operatorId } });
    return docs
      .map((d) => ({
        id: d.id, driverId: d.driverId, docType: d.docType, documentNumber: d.documentNumber,
        expiresAt: d.expiresAt, daysLeft: daysToExpiry(d.expiresAt.getTime(), now),
        expired: isExpired(d.expiresAt.getTime(), now),
        expiringSoon: isExpiringSoon(d.expiresAt.getTime(), now, warningDays),
      }))
      .filter((d) => d.expired || d.expiringSoon)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  /** A driver is compliant only when every recorded document is unexpired. */
  async complianceStatus(operatorId: string, driverId: string) {
    const now = Date.now();
    const docs = await this.docRepo.find({ where: { operatorId, driverId } });
    const compliant = docs.length > 0 && allValid(docs.map((d) => d.expiresAt.getTime()), now);
    return { driverId, documentCount: docs.length, compliant };
  }

  recordViolation(operatorId: string, dto: ViolationDto): Promise<DriverViolation> {
    return this.violationRepo.save(this.violationRepo.create({ operatorId, driverId: dto.driverId, type: dto.type, note: dto.note ?? null }));
  }
  violationsFor(operatorId: string, driverId: string): Promise<DriverViolation[]> {
    return this.violationRepo.find({ where: { operatorId, driverId }, order: { recordedAt: 'DESC' } });
  }

  recordTraining(operatorId: string, dto: TrainingDto): Promise<DriverTraining> {
    return this.trainingRepo.save(this.trainingRepo.create({
      operatorId, driverId: dto.driverId, program: dto.program,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    }));
  }
  trainingFor(operatorId: string, driverId: string): Promise<DriverTraining[]> {
    return this.trainingRepo.find({ where: { operatorId, driverId }, order: { createdAt: 'DESC' } });
  }
}
