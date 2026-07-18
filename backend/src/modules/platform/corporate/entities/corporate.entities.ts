import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** A company that books travel for its employees and is billed on a cycle (B2B). */
@Entity('corporate_accounts')
export class CorporateAccount {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 160 }) companyName: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) gstin: string | null;
  @Column({ type: 'varchar', length: 150 }) adminEmail: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) creditLimit: number;
  @Column({ type: 'varchar', length: 12, default: 'MONTHLY' }) billingCycle: string;
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' }) status: string; // ACTIVE | SUSPENDED
  @CreateDateColumn() createdAt: Date;
}

/** An employee authorised to travel under a corporate account (matched by email). */
@Entity('corporate_employees')
@Unique(['corporateId', 'email'])
export class CorporateEmployee {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) corporateId: string;
  @Index() @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'varchar', length: 120 }) fullName: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
