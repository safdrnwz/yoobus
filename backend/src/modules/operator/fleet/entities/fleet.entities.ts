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

export type VehicleDocType = 'INSURANCE' | 'PERMIT' | 'POLLUTION';

@Entity('fleet_vehicle_documents')
export class VehicleDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 12 }) docType: VehicleDocType;
  @Column({ type: 'varchar', length: 60 }) documentNumber: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
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
