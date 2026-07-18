import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A role an OPERATOR invented, rather than one Yoo Bus shipped.
 *
 * The built-in roles — OPERATOR_ADMIN, SUPPORT, DRIVER — cover most bus companies. They do not
 * cover all of them. A large operator has a Booking Operator who may sell but not refund, a
 * Counter Clerk tied to one counter, an Accountant who sees the money and none of the fleet, a
 * Conductor who may board passengers and nothing else. Forcing all of those into "SUPPORT"
 * means handing a counter clerk the power to cancel any booking on the network.
 *
 * ── Why Enterprise only, and why five ──
 *
 * Five is a product decision, not a technical one. Past five, an operator is no longer
 * modelling their organisation — they are avoiding thinking about it, and every custom role is
 * a permission matrix that somebody has to keep correct. A hundred half-understood roles is
 * how a company ends up with a driver who can issue refunds.
 *
 * ── What a custom role can NEVER do ──
 *
 * It is built from the SAME permission catalogue everything else uses, and it may only be
 * granted permissions that an OPERATOR_ADMIN already holds. An operator cannot invent a role
 * that reaches the platform: they cannot mint CREATE_OPERATOR, they cannot grant
 * CONFIGURE_PLATFORM_SETTINGS, and they cannot escalate past themselves. The ceiling is their
 * own authority, enforced on the server, on every request.
 *
 * ── What happens on downgrade ──
 *
 * Nothing is deleted. The rows stay; they simply stop being applied, and users on a custom
 * role fall back to their base role. Re-upgrade and everything comes back exactly as it was —
 * because destroying a customer's access model when they miss a payment is how you make sure
 * they never come back.
 */
@Entity('custom_roles')
@Index(['operatorId', 'name'], { unique: true })
export class CustomRole {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) operatorId: string;

  /** What the operator calls it — "Counter Clerk", "Night Shift Supervisor". */
  @Column({ type: 'varchar', length: 60 }) name: string;

  @Column({ type: 'varchar', length: 200, nullable: true }) description: string | null;

  /**
   * The permission keys this role grants. Validated against the catalogue on every write, and
   * against what an OPERATOR_ADMIN may hold — the operator's own authority is the ceiling.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" }) permissions: string[];

  /**
   * Off, without being deleted.
   *
   * This is what a downgrade flips. The role, its name and its whole permission set survive
   * untouched; they simply stop applying. Upgrade again and the operator's access model is
   * exactly where they left it.
   */
  @Column({ type: 'boolean', default: true }) isActive: boolean;

  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
