import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A partner webhook subscription. */
@Entity('api_webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) partnerId: string;
  @Column({ type: 'varchar', length: 300 }) url: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) eventTypes: string[];
  @Column({ type: 'varchar', length: 80 }) secret: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'int', default: 5 }) maxAttempts: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
