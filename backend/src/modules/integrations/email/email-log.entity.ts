import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// Audit: every email is logged with its operator context and recipient (proof of operator isolation).
@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 150 }) toEmail: string;
  @Index() @Column({ type: 'uuid', nullable: true }) operatorId: string | null;
  @Column({ type: 'varchar', length: 80 }) template: string;
  @Column({ type: 'varchar', length: 250 }) subject: string;
  @Column({ type: 'varchar', length: 15 }) status: string; // SENT/FAILED/DEV
  @Column({ type: 'varchar', length: 300, nullable: true }) error: string;
  @CreateDateColumn() createdAt: Date;
}
