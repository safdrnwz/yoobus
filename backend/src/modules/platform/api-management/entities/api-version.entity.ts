import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiVersionStatus } from '../../../../common/logic/api-management.util';

/** A published API version with its lifecycle status. */
@Entity('api_versions')
export class ApiVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 20 }) version: string;
  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' }) status: ApiVersionStatus;
  @Column({ type: 'timestamptz', nullable: true }) deprecatedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) retiredAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
