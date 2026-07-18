import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSubjectRequest } from './entities/data-subject-request.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { KeyRotation } from './entities/key-rotation.entity';
import { CreateDsrDto, RecordConsentDto, RotateKeyDto } from './dto/compliance.dto';
import { AppException } from '../../../common/errors/app-exception';
import { dsrCanTransition, DsrStatus, DsrType, isConsentGranted } from '../../../common/logic/compliance.util';

/** SuperAdmin compliance & data governance: DSRs, consent, key-rotation audit. */
@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(DataSubjectRequest) private readonly dsrRepo: Repository<DataSubjectRequest>,
    @InjectRepository(ConsentRecord) private readonly consentRepo: Repository<ConsentRecord>,
    @InjectRepository(KeyRotation) private readonly keyRepo: Repository<KeyRotation>,
  ) {}

  // ---- Data-subject requests ----
  createRequest(dto: CreateDsrDto): Promise<DataSubjectRequest> {
    return this.dsrRepo.save(this.dsrRepo.create({ subjectEmail: dto.subjectEmail, type: dto.type as DsrType, note: dto.note ?? null, status: 'PENDING' }));
  }

  listRequests(): Promise<DataSubjectRequest[]> {
    return this.dsrRepo.find({ order: { createdAt: 'DESC' } });
  }

  async advanceRequest(id: string, to: DsrStatus): Promise<DataSubjectRequest> {
    const r = await this.dsrRepo.findOne({ where: { id } });
    if (!r) throw new AppException('DSR_NOT_FOUND', 'Data-subject request not found.', HttpStatus.NOT_FOUND);
    const guard = dsrCanTransition(r.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    r.status = to;
    if (to === 'COMPLETED') r.completedAt = new Date();
    return this.dsrRepo.save(r);
  }

  // ---- Consent ----
  recordConsent(dto: RecordConsentDto): Promise<ConsentRecord> {
    return this.consentRepo.save(this.consentRepo.create({ subjectEmail: dto.subjectEmail, purpose: dto.purpose, granted: dto.granted }));
  }

  async consentStatus(subjectEmail: string, purpose: string): Promise<{ subjectEmail: string; purpose: string; granted: boolean }> {
    const rows = await this.consentRepo.find({ where: { subjectEmail } });
    const granted = isConsentGranted(rows.map((r) => ({ purpose: r.purpose, granted: r.granted, recordedAt: r.recordedAt.getTime() })), purpose);
    return { subjectEmail, purpose, granted };
  }

  // ---- Encryption key rotation audit ----
  rotateKey(dto: RotateKeyDto, userId?: string): Promise<KeyRotation> {
    return this.keyRepo.save(this.keyRepo.create({ keyAlias: dto.keyAlias, rotatedBy: userId ?? null }));
  }

  listKeyRotations(): Promise<KeyRotation[]> {
    return this.keyRepo.find({ order: { rotatedAt: 'DESC' } });
  }
}
