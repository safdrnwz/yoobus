import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type FuelTxnType = 'REFILL' | 'ADJUSTMENT' | 'THEFT' | 'LOSS';
export type FuelTxnStatus = 'PENDING' | 'APPROVED';

@Entity('fuel_transactions')
export class FuelTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 12 }) type: FuelTxnType;
  @Column({ type: 'numeric', precision: 8, scale: 2 }) litres: number;
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 }) pricePerLitre: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) cost: number;
  @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true }) odometerKm: number | null;
  @Column({ type: 'varchar', length: 10, default: 'PENDING' }) status: FuelTxnStatus;
  @Column({ type: 'varchar', length: 200, nullable: true }) note: string | null;
  @CreateDateColumn() recordedAt: Date;
}

@Entity('fuel_cards')
export class FuelCard {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid', nullable: true }) busId: string | null;
  @Column({ type: 'varchar', length: 40 }) cardNumber: string;
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' }) status: string; // ACTIVE|SUSPENDED
  @CreateDateColumn() createdAt: Date;
}
