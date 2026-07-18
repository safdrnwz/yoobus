import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PartnerStatus } from '../../../../common/logic/api-management.util';

/** An external API partner (e.g. an OTA). SuperAdmin onboards and manages it. */
@Entity('api_partners')
export class ApiPartner {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 120 }) name: string;
  @Index() @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'varchar', length: 12, default: 'PENDING' }) status: PartnerStatus;
  @Column({ type: 'varchar', length: 300, nullable: true }) callbackUrl: string | null;
  @Column({ type: 'int', default: 60 }) rateLimitPerMinute: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) scopes: string[];
  @Column({ type: 'varchar', length: 200, nullable: true }) statusReason: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
