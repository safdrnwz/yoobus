import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DeploymentStatus } from '../../../../common/logic/reliability.util';

/** A production deployment record with approval/rollback status. */
@Entity('deployment_logs')
export class DeploymentLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 40 }) version: string;
  @Column({ type: 'varchar', length: 20, default: 'production' }) environment: string;
  @Column({ type: 'varchar', length: 14, default: 'PENDING' }) status: DeploymentStatus;
  @Column({ type: 'uuid', nullable: true }) deployedBy: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
