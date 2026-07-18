import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Amenity catalogue (Bus Master spec §7.E). Stored separately from the Bus
 * Master row for flexible configuration — one row per (bus, amenity).
 */
export const AMENITY_CATALOG = [
  'AIR_CONDITIONING', 'WIFI', 'USB_CHARGING', 'POWER_SOCKET', 'READING_LIGHT',
  'BLANKET', 'PILLOW', 'WATER_BOTTLE', 'ENTERTAINMENT_SYSTEM', 'CURTAINS',
  'TOILET', 'CCTV', 'GPS', 'EMERGENCY_EXIT', 'FIRE_EXTINGUISHER',
  'MOBILE_CHARGER', 'LUGGAGE_SPACE', 'RECLINER_SEAT',
] as const;

export type AmenityCode = (typeof AMENITY_CATALOG)[number];

@Entity('bus_amenities')
@Index(['busId', 'amenity'], { unique: true })
export class BusAmenity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) operatorId: string;

  @Index() @Column({ type: 'uuid' }) busId: string;

  @Column({ type: 'varchar', length: 40 }) amenity: AmenityCode;

  @CreateDateColumn() createdAt: Date;
}
