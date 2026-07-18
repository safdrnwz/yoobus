import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SettingNamespace } from '../../../../common/logic/platform-config.util';

/**
 * A point-in-time snapshot of a namespace's settings, captured before each change so
 * SuperAdmin can compare and restore. This is distinct from the immutable audit trail:
 * it stores config state for rollback, not the action log.
 */
@Entity('config_versions')
export class ConfigVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 20 }) namespace: SettingNamespace;
  @Column({ type: 'jsonb' }) snapshot: Record<string, unknown>;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn() createdAt: Date;
}
