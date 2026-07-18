import { Column, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/** Monthly SMS/WhatsApp usage per operator, used to enforce plan credit allowances. */
@Entity('messaging_usage')
@Unique(['operatorId', 'yearMonth', 'channel'])
export class MessagingUsage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 7 }) yearMonth: string; // 'YYYY-MM'
  @Column({ type: 'varchar', length: 10 }) channel: string;  // SMS | WHATSAPP
  @Column({ type: 'int', default: 0 }) count: number;
  @UpdateDateColumn() updatedAt: Date;
}
