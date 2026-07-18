import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LayoutDefinition } from '../../../../common/logic/seat-layout.util';

export type LayoutStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * A drawing of the inside of a bus, owned by one operator, reusable across many buses.
 *
 * VERSIONING, and why it works this way:
 *
 * A published template is never edited again. Editing it would change the meaning of tickets
 * already sold — renumber a row and a passenger's seat "1A" quietly becomes someone else's
 * seat. So publishing freezes the row, and the next change starts a NEW row with the same
 * `familyId` and `version + 1`.
 *
 * A bus points at one specific version. A trip copies that version at creation. Nothing that
 * happens to the template afterwards can reach backwards into a trip that already exists.
 *
 *     familyId "volvo-sleeper"
 *       ├── v1  PUBLISHED   ← bus DL01AB1234 still on this
 *       ├── v2  PUBLISHED   ← bus DL01CD5678 on this
 *       └── v3  DRAFT       ← being drawn right now
 */
@Entity('seat_layout_templates')
@Index(['operatorId', 'familyId', 'version'], { unique: true })
export class SeatLayoutTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) operatorId: string;

  /**
   * Ties every version of the same layout together. "Volvo Sleeper v1" and "Volvo Sleeper v2"
   * share a familyId; a brand new layout gets a brand new one.
   */
  @Index() @Column({ type: 'uuid' }) familyId: string;

  @Column({ type: 'int', default: 1 }) version: number;

  @Column({ type: 'varchar', length: 120 }) name: string;

  /** Which kind of coach this was drawn for. Only ever a hint — nothing is enforced on it. */
  @Column({ type: 'varchar', length: 40, nullable: true }) busType: string | null;

  @Index() @Column({ type: 'varchar', length: 10, default: 'DRAFT' }) status: LayoutStatus;

  /** The drawing itself. Decks, items, coordinates, seat numbers, properties. */
  @Column({ type: 'jsonb', default: () => "'{\"decks\":[]}'" })
  definition: LayoutDefinition;

  /** Derived at publish time so a list screen never has to parse every drawing. */
  @Column({ type: 'int', default: 0 }) seatCount: number;

  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
