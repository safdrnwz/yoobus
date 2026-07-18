import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A rotating refresh token (only the SHA-256 hash is stored). Rotation revokes the old one. */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) userId: string;
  @Index() @Column({ type: 'varchar', length: 64 }) tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) replacedByTokenId: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) userAgent: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) ip: string | null;
  @CreateDateColumn() createdAt: Date;
}
