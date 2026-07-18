import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WorkOrderStatus } from '../../../../common/logic/work-order.util';

@Entity('fleet_work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 120 }) title: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 12, default: 'OPEN' }) status: WorkOrderStatus;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) cost: number;
  @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

export type VehicleDocType = string; // catalogue lives in common/logic/bus-document.util (BUS_DOC_TYPES)

/**
 * Bus documents (Bus Master spec §8.F). Extended in place — this entity was already
 * the home for vehicle documents, so the spec's full lifecycle (issue/expiry dates,
 * file link, document + verification status, remarks) lives here instead of a
 * duplicate table.
 */
@Entity('fleet_vehicle_documents')
export class VehicleDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 20 }) docType: VehicleDocType;
  @Column({ type: 'varchar', length: 60 }) documentNumber: string;
  /** Nullable — expiry is required only where the document type says so (spec §8.F). */
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) issueDate: Date | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) issuingAuthority: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) documentFileUrl: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) documentFileName: string | null;
  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' }) documentStatus: string;
  @Column({ type: 'varchar', length: 12, default: 'PENDING' }) verificationStatus: string;
  @Column({ type: 'uuid', nullable: true }) verifiedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) remarks: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('fleet_parts_inventory')
export class PartInventory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 80 }) partName: string;
  @Column({ type: 'int', default: 0 }) quantity: number;
  @UpdateDateColumn() updatedAt: Date;
}
