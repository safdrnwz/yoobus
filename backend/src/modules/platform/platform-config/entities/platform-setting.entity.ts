import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { SettingNamespace } from '../../../../common/logic/platform-config.util';

/** A single global platform setting (namespace + key + value). SuperAdmin-managed. */
@Entity('platform_settings')
@Unique(['namespace', 'key'])
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 20 }) namespace: SettingNamespace;
  @Column({ type: 'varchar', length: 60 }) key: string;
  @Column({ type: 'jsonb' }) value: unknown;
  @Column({ type: 'uuid', nullable: true }) updatedBy: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
