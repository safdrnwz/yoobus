import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only audit of platform-admin impersonation sessions. */
@Entity('impersonation_audits')
export class ImpersonationAudit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) adminId: string;
  @Index() @Column({ type: 'uuid' }) targetUserId: string;
  @Column({ type: 'varchar', length: 150 }) targetEmail: string;
  @CreateDateColumn() createdAt: Date;
}
