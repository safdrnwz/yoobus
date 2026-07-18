import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('reviews')
@Index(['userId', 'tripId'], { unique: true })
export class Review {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) userId: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'int' }) rating: number; // 1..5
  @Column({ type: 'varchar', length: 500, nullable: true }) comment: string;
  @CreateDateColumn() createdAt: Date;
}
