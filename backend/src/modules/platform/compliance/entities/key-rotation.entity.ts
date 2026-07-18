import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only audit of encryption-key rotations. */
@Entity('key_rotations')
export class KeyRotation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 60 }) keyAlias: string;
  @Column({ type: 'uuid', nullable: true }) rotatedBy: string | null;
  @CreateDateColumn() rotatedAt: Date;
}
