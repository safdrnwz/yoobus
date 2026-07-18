import { SeatFareMap } from '../../../../common/logic/fare.util';
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BusType } from '../../../../common/enums/bus-type.enum';

@Entity('buses')
export class Bus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Globally unique, so a single bus always belongs to exactly one operator.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  registrationNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  operatorId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: BusType, default: BusType.AC_SEATER })
  busType: BusType;

  @Column({ type: 'int' })
  totalSeats: number;

  /* ───────────── Bus Master spec — identity & lifecycle (§3.A) ───────────── */

  /** Internal fleet identifier, unique per operator. e.g. BUS-001. */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  fleetNumber: string | null;

  /**
   * Operational lifecycle status (§3.A.7). `isActive` below is kept as the legacy
   * boolean the booking chain reads; it is always synced to (busStatus === ACTIVE).
   */
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  busStatus: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE' | 'RETIRED' | 'BLOCKED';

  @Column({ type: 'varchar', length: 20, nullable: true })
  ownershipType: 'OWNED' | 'LEASED' | 'ATTACHED' | 'CONTRACTED' | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  busCategory: 'STANDARD' | 'PREMIUM' | 'LUXURY' | 'EXECUTIVE' | null;

  @Column({ type: 'date', nullable: true })
  registrationDate: string | null;

  /**
   * Vehicle details (§4.B) as one document — manufacturer, model, modelYear,
   * chassisNumber, engineNumber, vehicleType, fuelType, acType, vehicleColor,
   * totalVehicleCapacity, dimensions, weights. Chassis/engine uniqueness is
   * enforced in the service (per operator) since jsonb keys can't carry a
   * partial unique index portably.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  vehicleDetails: Record<string, any>;

  /* ───────────── Audit (§15.M) — soft delete already via deletedAt ───────────── */
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ type: 'uuid', nullable: true }) updatedBy: string | null;

  // drag-and-drop seat layout (cells: seat/aisle/gap/door), + seat attributes
  @Column({ type: 'jsonb' })
  seatLayout: any; // { decks:[{rows, cols, cells:[{type, seatNumber, attrs}]}] }

  @Column({ type: 'jsonb' })
  seatMap: string[]; // flat list of bookable seat numbers

  // Operator-configurable ladies-reserved seat numbers (NOT hardcoded).
  // e.g. ["L3", "L4", "U7"] — only female passengers may book these.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  ladiesReservedSeats: string[];

  /** Seats restricted to male passengers (seat gender rule MALE). Derived from layout or set directly. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  maleOnlySeats: string[];

  // Seat adjacency map for paired-seat gender validation.
  // e.g. { "L4": "L3", "L3": "L4" } — L3 & L4 are a paired berth/pair.
  // If one is booked by a female, the paired seat is female-only.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  seatAdjacency: Record<string, string>;

  /**
   * What each seat is worth, relative to the others.
   *
   *   { "1A": { multiplier: 1.15 }, "40": { multiplier: 0.9, delta: -50 } }
   *
   * A seat with no entry is a standard seat (multiplier 1). Every seat on a trip used to
   * cost exactly the same, which is not how buses are sold — a lower berth outsells an
   * upper one and the back row goes last.
   *
   * Stored on the BUS, not the trip, because seat desirability is physical: 1A is the
   * front-left window on every trip that bus will ever run. Per-trip would mean re-entering
   * the same map every single day.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  seatFares: SeatFareMap;

  /**
   * The published layout this bus was built from, and which VERSION of it.
   *
   * The columns above — seatMap, seatLayout, ladiesReservedSeats, seatAdjacency — are now
   * DERIVED from that layout at assignment time. They are kept because the booking engine,
   * the OTA API and the gender rules have always read them, and rewriting six modules to
   * parse a drawing instead would have put the money path at risk for nothing.
   *
   * The version matters: republishing a layout must never reach backwards into a bus that is
   * already running trips on the old one. Migrating is an explicit act.
   */
  @Index() @Column({ type: 'uuid', nullable: true }) layoutTemplateId: string | null;
  @Column({ type: 'int', nullable: true }) layoutVersion: number | null;

  // one bus -> one active route (mapping lock)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  currentRouteId: string | null;

  // one bus -> one driver (1:1)
  @Column({ type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // setup fee invoice idempotency
  @Column({ type: 'boolean', default: false })
  setupFeeInvoiced: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
