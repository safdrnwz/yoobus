import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OperatorStatus } from '../../../../common/enums/operator-status.enum';
import { PLATFORM_DEFAULTS } from '../../../../common/config/platform-defaults';

// Operator root. All operator-scoped data is keyed to this operator.id (operator_id).
@Entity('operators')
export class Operator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-facing sequential code, assigned only when the operator is approved (1, 2, 3, ...).
  @Index({ unique: true, where: '"operatorCode" IS NOT NULL' })
  @Column({ type: 'int', nullable: true })
  operatorCode: number | null;

  // ── Per-operator billing configuration (set by SuperAdmin; different for every operator).
  //    Yoo Bus has no plans/tiers: every operator gets every feature. What differs per operator
  //    is only their commercial terms, configured here.

  // One-time platform (onboarding) fee, charged once. See also setupFeePerBus (per bus).
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  oneTimePlatformFee: number;

  // Communication charges billed to the operator, PER MESSAGE actually sent.
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) smsCharge: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) whatsappCharge: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) emailCharge: number;

  // Extensible: any other named charges the SuperAdmin wants to bill this operator.
  // e.g. { "gpsPerBus": 199, "prioritySupport": 4999 }
  @Column({ type: 'jsonb', default: () => "'{}'" })
  extraCharges: Record<string, number>;

  /**
   * Operator-configurable gender seat rules (seat-gender spec §15/§23).
   * Partial — anything unset falls back to DEFAULT_GENDER_RULES (spec §24):
   * { femaleAdjacentProtection, differentBookingMaleFemale, sameBookingMaleFemale,
   *   bothDirectionProtection, familyGroupException }
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  genderRules: Record<string, any>;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  legalName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  brandName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Index({ unique: true, where: '"gstin" IS NOT NULL' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin: string;

  @Index({ unique: true, where: '"pan" IS NOT NULL' })
  @Column({ type: 'varchar', length: 12, nullable: true })
  pan: string;

  @Column({ type: 'jsonb', nullable: true })
  address: any;

  @Column({ type: 'jsonb', nullable: true })
  bankDetails: any; // Used for settlements (encryption at rest is recommended).

  @Column({ type: 'jsonb', nullable: true })
  documents: any; // {gstCert, panCard, ...} S3 keys

  // Phase 3: white-label storefront branding (logo, theme color, subdomain)
  @Column({ type: 'jsonb', nullable: true })
  branding: any;

  // The SuperAdmin sets this individually for each operator.
  @Column({ type: 'numeric', precision: 5, scale: 4, default: PLATFORM_DEFAULTS.PAYMENT.defaultCommissionRate })
  commissionRate: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: PLATFORM_DEFAULTS.PAYMENT.setupFeePerBus })
  setupFeePerBus: number;

  @Column({ type: 'enum', enum: OperatorStatus, default: OperatorStatus.PENDING_VERIFICATION })
  status: OperatorStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  statusReason: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
