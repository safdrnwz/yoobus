import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { HubPosition } from '../../../../common/logic/hub.util';

/** A hub location in the operator's hub-and-spoke network. */
@Entity('hubs')
export class Hub {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'uuid' }) stopId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) city: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}

/** A spoke: a route attached to a hub, with the hub's position on that route. */
@Entity('hub_routes')
@Unique(['hubId', 'routeId'])
export class HubRoute {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) hubId: string;
  @Column({ type: 'uuid' }) routeId: string;
  @Column({ type: 'varchar', length: 14 }) hubPosition: HubPosition;
  @CreateDateColumn() createdAt: Date;
}
