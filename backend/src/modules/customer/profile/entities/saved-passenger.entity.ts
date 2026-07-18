import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A frequent co-traveller saved by a customer for quick booking. */
@Entity('saved_passengers')
export class SavedPassenger {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 120 }) fullName: string;
  @Column({ type: 'int', nullable: true }) age: number | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) gender: string | null; // M | F | OTHER
  @Column({ type: 'varchar', length: 40, nullable: true }) idType: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) idNumber: string | null;
  @CreateDateColumn() createdAt: Date;
}
