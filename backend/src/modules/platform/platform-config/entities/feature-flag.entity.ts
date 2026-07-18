import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A platform feature flag with optional schedule and per-operator overrides. */
@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 60 }) key: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: false }) enabledGlobally: boolean;
  @Column({ type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ type: 'jsonb', default: () => "'{}'" }) operatorOverrides: Record<string, boolean>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
