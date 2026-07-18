import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only log of webhook delivery attempts. */
@Entity('api_webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) webhookId: string;
  @Column({ type: 'varchar', length: 60 }) event: string;
  @Column({ type: 'text' }) payload: string;
  @Column({ type: 'varchar', length: 128 }) signature: string;
  @Column({ type: 'varchar', length: 12, default: 'PENDING' }) status: string; // PENDING | DELIVERED | FAILED
  @Column({ type: 'int', default: 0 }) attempts: number;
  @CreateDateColumn() createdAt: Date;
}
