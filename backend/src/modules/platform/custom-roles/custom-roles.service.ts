import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../../common/errors/app-exception';
import { PERMISSION_CATALOG, permissionsForRole } from '../../../common/rbac/permission-catalog';
import { Role } from '../../../common/enums/role.enum';
import { User } from '../../customer/users/entities/user.entity';
import { CustomRole } from './entities/custom-role.entity';

/**
 * IAM — the roles an OPERATOR invents.
 *
 * Available to EVERY operator now (Yoo Bus no longer has plans/tiers), capped at five, and
 * built from the same permission catalogue everything else uses. An operator can only grant
 * what an OPERATOR_ADMIN already holds: the ceiling is their own authority, enforced on the
 * server, on every request. A custom role can never reach the platform.
 */
const CUSTOM_ROLE_LIMIT = 5;

@Injectable()
export class CustomRolesService {
  constructor(
    @InjectRepository(CustomRole) private readonly repo: Repository<CustomRole>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** The ceiling: an operator may only grant what an OPERATOR_ADMIN already holds (never platform perms). */
  private grantable(): Set<string> {
    const adminHolds = new Set(permissionsForRole(Role.OPERATOR_ADMIN));
    const platform = new Set(
      PERMISSION_CATALOG.filter((p) => p.group.startsWith('PLATFORM_')).map((p) => p.key),
    );
    return new Set([...adminHolds].filter((k: string) => !platform.has(k)));
  }

  async grantablePermissions() {
    const allowed = this.grantable();
    return PERMISSION_CATALOG.filter((p) => allowed.has(p.key)).map((p) => ({
      key: p.key, label: p.label, group: p.group,
    }));
  }

  list(operatorId: string) {
    return this.repo.find({ where: { operatorId }, order: { createdAt: 'ASC' } });
  }

  private async mine(operatorId: string, id: string): Promise<CustomRole> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new AppException('ROLE_NOT_FOUND', 'That role does not exist.', HttpStatus.NOT_FOUND);
    if (r.operatorId !== operatorId) {
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'That role belongs to another operator.', HttpStatus.FORBIDDEN);
    }
    return r;
  }

  private validatePermissions(keys: string[]): void {
    const allowed = this.grantable();
    const unknown = keys.filter((k) => !PERMISSION_CATALOG.some((p) => p.key === k));
    if (unknown.length) {
      throw new AppException('PERMISSION_UNKNOWN', `No such permission: ${unknown.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    const forbidden = keys.filter((k) => !allowed.has(k));
    if (forbidden.length) {
      throw new AppException('PERMISSION_NOT_GRANTABLE', `You cannot grant what you do not hold: ${forbidden.join(', ')}`, HttpStatus.FORBIDDEN);
    }
  }

  async create(operatorId: string, userId: string, dto: { name: string; description?: string; permissions: string[] }) {
    const existing = await this.repo.count({ where: { operatorId, isActive: true } });
    if (existing >= CUSTOM_ROLE_LIMIT) {
      throw new AppException(
        'CUSTOM_ROLE_LIMIT_REACHED',
        `You can have up to ${CUSTOM_ROLE_LIMIT} custom roles. You already have ${existing}.`,
        HttpStatus.FORBIDDEN,
      );
    }
    this.validatePermissions(dto.permissions);
    const clash = await this.repo.findOne({ where: { operatorId, name: dto.name } });
    if (clash) {
      throw new AppException('ROLE_NAME_TAKEN', `You already have a role called "${dto.name}".`, HttpStatus.CONFLICT);
    }
    return this.repo.save(
      this.repo.create({
        operatorId, name: dto.name, description: dto.description ?? null,
        permissions: dto.permissions, isActive: true, createdBy: userId,
      }),
    );
  }

  async update(operatorId: string, id: string, patch: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.mine(operatorId, id);
    if (patch.permissions) this.validatePermissions(patch.permissions);
    if (patch.name !== undefined) role.name = patch.name;
    if (patch.description !== undefined) role.description = patch.description;
    if (patch.permissions !== undefined) role.permissions = patch.permissions;
    return this.repo.save(role);
  }

  async remove(operatorId: string, id: string) {
    const role = await this.mine(operatorId, id);
    const holders = await this.users.count({ where: { operatorId, customRoleId: role.id } });
    if (holders > 0) {
      throw new AppException(
        'ROLE_IN_USE',
        `${holders} ${holders === 1 ? 'person is' : 'people are'} on this role. Move them to another role first.`,
        HttpStatus.CONFLICT,
      );
    }
    await this.repo.softRemove(role);
    return { ok: true };
  }

  async assign(operatorId: string, userId: string, roleId: string | null) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new AppException('USER_NOT_FOUND', 'That person does not exist.', HttpStatus.NOT_FOUND);
    if (user.operatorId !== operatorId) {
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'That person belongs to another operator.', HttpStatus.FORBIDDEN);
    }
    if (user.role === Role.OPERATOR_ADMIN) {
      throw new AppException('CANNOT_NARROW_ADMIN', 'An operator admin cannot be put on a custom role.', HttpStatus.BAD_REQUEST);
    }
    if (roleId) await this.mine(operatorId, roleId);
    user.customRoleId = roleId;
    await this.users.save(user);
    return { userId, customRoleId: roleId };
  }

  /** The permissions a custom role actually grants right now (ceiling re-enforced on read). */
  async permissionsFor(operatorId: string, customRoleId: string | null): Promise<string[] | null> {
    if (!customRoleId) return null;
    const role = await this.repo.findOne({ where: { id: customRoleId, operatorId, isActive: true } });
    if (!role) return null;
    const allowed = this.grantable();
    return role.permissions.filter((p) => allowed.has(p));
  }
}
