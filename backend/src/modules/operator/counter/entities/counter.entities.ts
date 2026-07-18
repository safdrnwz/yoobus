import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A physical sales counter/branch where walk-in tickets are sold. */
@Entity('counters')
export class Counter {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 160, nullable: true }) location: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}

/** A counter staff member (attribution + daily closing); not a login account. */
@Entity('counter_agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid', nullable: true }) counterId: string | null;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}

/** A cash/UPI/card sale made at a counter by an agent, tied to a booking. */
@Entity('counter_sales')
@Index(['counterId', 'createdAt'])
export class CounterSale {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) counterId: string;
  @Column({ type: 'uuid' }) agentId: string;
  @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 8, default: 'CASH' }) paymentMode: string; // CASH | UPI | CARD
  @CreateDateColumn() createdAt: Date;
}
