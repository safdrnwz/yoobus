import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Role } from '../enums/role.enum';

/**
 * A per-operator refinement of a role's default permissions. Lets an operator admin grant
 * or revoke a specific permission for one of their staff roles, without changing platform
 * defaults or duplicating any logic.
 */
@Entity('permission_overrides')
@Unique(['operatorId', 'role', 'permissionKey'])
export class PermissionOverride {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 20 }) role: Role;
  @Column({ type: 'varchar', length: 60 }) permissionKey: string;
  @Column({ type: 'boolean' }) granted: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
