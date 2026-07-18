import { Column, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/** Operator control: per operator + channel, whether to send an optional notification. */
@Entity('operator_notification_preferences')
@Unique(['operatorId', 'notificationKey', 'channel'])
export class OperatorNotificationPreference {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 40 }) notificationKey: string;
  @Column({ type: 'varchar', length: 10, default: 'EMAIL' }) channel: string; // EMAIL | SMS | WHATSAPP
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @UpdateDateColumn() updatedAt: Date;
}
