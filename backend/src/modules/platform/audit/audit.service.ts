import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { LogFilter, paginate } from '../../../common/logic/log-filter.util';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.repo.save(this.repo.create(entry));
    } catch (e) {
      this.logger.error(`Failed to persist audit log: ${(e as Error).message}`);
    }
  }

  list(operatorId: string): Promise<AuditLog[]> {
    return this.repo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  // SuperAdmin: ALL logs across every operator and every platform role (government norms).
  async queryAll(filter: LogFilter, page = 1, pageSize = 50) {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (filter.operatorId !== undefined) {
      if (filter.operatorId === null) qb.andWhere('a.operatorId IS NULL');
      else qb.andWhere('a.operatorId = :oid', { oid: filter.operatorId });
    }
    if (filter.userId) qb.andWhere('a.userId = :uid', { uid: filter.userId });
    if (filter.role) qb.andWhere('a.role = :role', { role: filter.role });
    if (filter.method) qb.andWhere('a.method = :method', { method: filter.method });
    if (filter.action) qb.andWhere('a.action = :action', { action: filter.action });
    if (filter.from) qb.andWhere('a.createdAt >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('a.createdAt <= :to', { to: filter.to });
    const all = await qb.getMany();
    return paginate(all, page, pageSize);
  }
}