import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RouteStop } from './route-stop.entity';
@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string; // operator-scoped
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @OneToMany(() => RouteStop, (rs) => rs.route, { cascade: true, eager: true })
  routeStops: RouteStop[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
