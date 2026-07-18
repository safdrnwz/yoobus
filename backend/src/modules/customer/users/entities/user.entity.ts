import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../../../common/enums/role.enum';

// USER (passenger) => operatorId null. Staff => operatorId set (operator).
@Entity('users')
@Index(['email', 'operatorId'], { unique: true })
// Globally-unique email + mobile for platform passengers (operatorId IS NULL).
// Partial unique indexes so operator staff (per-operator) are unaffected.
@Index('uq_user_email_global', { synchronize: false })
@Index('uq_user_phone_global', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  // Profile-completion fields (required before a passenger can book).
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string | null; // MALE | FEMALE | OTHER

  @Column({ type: 'varchar', select: false })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  // null => platform/passenger; set => operator staff
  @Index()
  @Column({ type: 'uuid', nullable: true })
  operatorId: string | null;

  /**
   * A custom role, if their operator is on Enterprise and has put them on one.
   *
   * Their base `role` above is NEVER replaced. It is what they fall back to when the operator
   * downgrades, or when a custom role is removed — a person whose role vanishes must not
   * silently become a person with no permissions at all.
   */
  @Index() @Column({ type: 'uuid', nullable: true })
  customRoleId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // DPDP Act 2023: consent capture
  @Column({ type: 'boolean', default: false })
  consentGiven: boolean;

  @Column({ type: 'boolean', default: false }) passwordSet: boolean;
  @Column({ type: 'boolean', default: false }) emailVerified: boolean;
  @Column({ type: 'boolean', default: false }) phoneVerified: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
