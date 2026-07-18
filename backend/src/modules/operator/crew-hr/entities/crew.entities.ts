import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AttendanceStatus } from '../../../../common/logic/crew-hr.util';

@Entity('crew_employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 120 }) fullName: string;
  @Column({ type: 'varchar', length: 40 }) designation: string; // DRIVER, CONDUCTOR, MANAGER, etc.
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}

@Entity('crew_shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 60 }) name: string;
  @Column({ type: 'timestamptz' }) startAt: Date;
  @Column({ type: 'timestamptz' }) endAt: Date;
  @Column({ type: 'uuid', nullable: true }) employeeId: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('crew_attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) employeeId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'timestamptz', nullable: true }) checkIn: Date | null;
  @Column({ type: 'varchar', length: 8, default: 'ABSENT' }) status: AttendanceStatus;
  @CreateDateColumn() createdAt: Date;
}

@Entity('crew_leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) employeeId: string;
  @Column({ type: 'timestamptz' }) fromAt: Date;
  @Column({ type: 'timestamptz' }) toAt: Date;
  @Column({ type: 'varchar', length: 200, nullable: true }) reason: string | null;
  @Column({ type: 'varchar', length: 10, default: 'PENDING' }) status: string; // PENDING|APPROVED|REJECTED
  @CreateDateColumn() createdAt: Date;
}
