import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LeadStatus } from '../../../../common/enums/lead-status.enum';

// "Become an Operator" form (bina login). Onboarding pipeline.
@Entity('operator_leads')
export class OperatorLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  companyName: string;


  @Column({ type: 'varchar', length: 120 })
  contactName: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'int', default: 1 })
  totalBuses: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  // full onboarding step me bharte hain
  @Column({ type: 'jsonb', nullable: true })
  kyc: any; // {gstin, pan, address, bank, documents...}

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  statusReason: string;

  // approve hone par bana operator
  @Column({ type: 'uuid', nullable: true })
  operatorId: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
