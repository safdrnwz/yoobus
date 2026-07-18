import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Route } from './route.entity';
import { Stop } from '../../stops/entities/stop.entity';
@Entity('route_stops')
@Index(['route', 'stopOrder'], { unique: true })
export class RouteStop {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Route, (r) => r.routeStops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' }) route: Route;
  @Column({ name: 'route_id' }) routeId: string;
  @ManyToOne(() => Stop, { eager: true })
  @JoinColumn({ name: 'stop_id' }) stop: Stop;
  @Column({ name: 'stop_id' }) stopId: string;
  @Column({ type: 'int' }) stopOrder: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) fareFromOrigin: number;
  @Column({ type: 'int', default: 0 }) arrivalOffsetMin: number;
}
