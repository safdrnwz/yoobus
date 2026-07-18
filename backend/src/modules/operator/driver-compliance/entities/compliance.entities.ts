import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DriverDocType = 'LICENSE' | 'POLICE_VERIFICATION' | 'MEDICAL';

@Entity('driver_documents')
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) driverId: string;
  @Column({ type: 'varchar', length: 20 }) docType: DriverDocType;
  @Column({ type: 'varchar', length: 60 }) documentNumber: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'varchar', length: 200, nullable: true }) fileKey: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('driver_violations')
export class DriverViolation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) driverId: string;
  @Column({ type: 'varchar', length: 60 }) type: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) note: string | null;
  @CreateDateColumn() recordedAt: Date;
}

@Entity('driver_trainings')
export class DriverTraining {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) driverId: string;
  @Column({ type: 'varchar', length: 100 }) program: string;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
