import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TicketStatus } from '../../../../common/logic/support-crm.util';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid', nullable: true }) raisedByUserId: string | null;
  @Column({ type: 'varchar', length: 150 }) subject: string;
  @Column({ type: 'varchar', length: 1000, nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 12, default: 'OPEN' }) status: TicketStatus;
  @Column({ type: 'uuid', nullable: true }) assigneeId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('support_complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid', nullable: true }) customerUserId: string | null;
  @Column({ type: 'varchar', length: 150 }) subject: string;
  @Column({ type: 'varchar', length: 12, default: 'OPEN' }) status: TicketStatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('support_lost_found')
export class LostFoundCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 200 }) itemDescription: string;
  @Column({ type: 'uuid', nullable: true }) tripId: string | null;
  @Column({ type: 'varchar', length: 12, default: 'OPEN' }) status: string; // OPEN | CLOSED
  @CreateDateColumn() createdAt: Date;
}

@Entity('passenger_flags')
export class PassengerFlag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) customerUserId: string;
  @Column({ type: 'boolean', default: true }) blacklisted: boolean;
  @Column({ type: 'varchar', length: 200, nullable: true }) reason: string | null;
  @UpdateDateColumn() updatedAt: Date;
}
