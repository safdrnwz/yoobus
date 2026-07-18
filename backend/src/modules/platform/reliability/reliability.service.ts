import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundJob } from './entities/background-job.entity';
import { DeploymentLog } from './entities/deployment-log.entity';
import { ImpersonationAudit } from './entities/impersonation-audit.entity';
import { AppException } from '../../../common/errors/app-exception';
import { deploymentCanTransition, DeploymentStatus, jobCanTransition, JobStatus } from '../../../common/logic/reliability.util';
import { AuthService } from '../../system/auth/auth.service';
import { UsersService } from '../../customer/users/users.service';

/** SuperAdmin reliability/ops: background jobs, deployments, and audited impersonation. */
@Injectable()
export class ReliabilityService {
  constructor(
    @InjectRepository(BackgroundJob) private readonly jobRepo: Repository<BackgroundJob>,
    @InjectRepository(DeploymentLog) private readonly deployRepo: Repository<DeploymentLog>,
    @InjectRepository(ImpersonationAudit) private readonly impRepo: Repository<ImpersonationAudit>,
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  // ---- Background jobs ----
  registerJob(name: string): Promise<BackgroundJob> {
    return this.jobRepo.save(this.jobRepo.create({ name, status: 'QUEUED' }));
  }
  listJobs(): Promise<BackgroundJob[]> {
    return this.jobRepo.find({ order: { updatedAt: 'DESC' } });
  }
  async setJobStatus(id: string, to: JobStatus, error?: string): Promise<BackgroundJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new AppException('JOB_NOT_FOUND', 'Background job not found.', HttpStatus.NOT_FOUND);
    const guard = jobCanTransition(job.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    job.status = to;
    if (to === 'RUNNING') { job.attempts += 1; job.lastRunAt = new Date(); }
    if (to === 'FAILED') job.error = error ?? null;
    return this.jobRepo.save(job);
  }
  retryJob(id: string): Promise<BackgroundJob> {
    return this.setJobStatus(id, 'QUEUED');
  }

  // ---- Deployments ----
  logDeployment(version: string, userId?: string): Promise<DeploymentLog> {
    return this.deployRepo.save(this.deployRepo.create({ version, deployedBy: userId ?? null, status: 'PENDING' }));
  }
  listDeployments(): Promise<DeploymentLog[]> {
    return this.deployRepo.find({ order: { createdAt: 'DESC' } });
  }
  async setDeploymentStatus(id: string, to: DeploymentStatus): Promise<DeploymentLog> {
    const d = await this.deployRepo.findOne({ where: { id } });
    if (!d) throw new AppException('DEPLOYMENT_NOT_FOUND', 'Deployment not found.', HttpStatus.NOT_FOUND);
    const guard = deploymentCanTransition(d.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    d.status = to;
    return this.deployRepo.save(d);
  }

  // ---- Impersonation (audited) ----
  async impersonate(adminId: string, targetUserId: string) {
    const target = await this.users.findById(targetUserId);
    if (!target) throw new AppException('USER_NOT_FOUND', 'Target user not found.', HttpStatus.NOT_FOUND);
    await this.impRepo.save(this.impRepo.create({ adminId, targetUserId, targetEmail: target.email }));
    return this.auth.impersonate(target, adminId);
  }
  listImpersonations(): Promise<ImpersonationAudit[]> {
    return this.impRepo.find({ order: { createdAt: 'DESC' } });
  }
}
