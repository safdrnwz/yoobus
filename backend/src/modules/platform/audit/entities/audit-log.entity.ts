import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
/** Immutable audit trail of mutating actions (Rule 149). */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) role: string | null;
  @Index() @Column({ type: 'uuid', nullable: true }) operatorId: string | null;
  @Column({ type: 'varchar', length: 10 }) method: string;
  @Column({ type: 'varchar', length: 300 }) path: string;
  @Column({ type: 'int' }) statusCode: number;
  @Column({ type: 'varchar', length: 60, nullable: true }) ipAddress: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) userAgent: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) action: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) correlationId: string | null;
  @CreateDateColumn() createdAt: Date;
}
