import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiKeyStatus } from '../../../../common/logic/api-management.util';

/** An API key for a partner. Only the hash is stored; the raw key is shown once. */
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) partnerId: string;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 20 }) keyPrefix: string;
  @Column({ type: 'varchar', length: 16 }) keyMasked: string;
  @Index() @Column({ type: 'varchar', length: 128 }) keyHash: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) scopes: string[];
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' }) status: ApiKeyStatus;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
