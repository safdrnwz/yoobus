import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../enums/role.enum';
import { PermissionOverride } from './permission-override.entity';
import { PERMISSION_CATALOG, permissionsForRole } from './permission-catalog';
import { hasPermission, resolveEffectivePermissions } from '../logic/permission-resolve.util';

/**
 * Resolves effective permissions for a user from the single-source catalog plus any
 * per-operator overrides. A short in-memory cache keeps the per-request guard cheap.
 */
@Injectable()
export class RbacService {
  private cache = new Map<string, { perms: string[]; at: number }>();
  private readonly ttlMs = 30_000;

  constructor(
    @InjectRepository(PermissionOverride) private readonly overrideRepo: Repository<PermissionOverride>,
  ) {}

  private cacheKey(role: Role, operatorId: string | null): string {
    return `${operatorId ?? 'platform'}:${role}`;
  }

  invalidate(operatorId: string | null, role?: Role): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${operatorId ?? 'platform'}:`) && (!role || key.endsWith(`:${role}`))) {
        this.cache.delete(key);
      }
    }
  }

  async effectivePermissions(role: Role, operatorId: string | null): Promise<string[]> {
    const key = this.cacheKey(role, operatorId);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.perms;

    const base = permissionsForRole(role);
    const overrides = operatorId ? await this.overrideRepo.find({ where: { operatorId, role } }) : [];
    const perms = resolveEffectivePermissions(base, overrides);
    this.cache.set(key, { perms, at: Date.now() });
    return perms;
  }

  async can(role: Role, operatorId: string | null, required: string[]): Promise<boolean> {
    const effective = await this.effectivePermissions(role, operatorId);
    return hasPermission(effective, required);
  }

  /**
   * The permissions a person ACTUALLY has, custom role included.
   *
   * Every request in the product funnels through here, so two properties matter more than
   * anything else:
   *
   *  1. ADDITIVE ONLY. A custom role can extend what a base role holds; it can never take
   *     something away that the base role has, and it can never reach past OPERATOR_ADMIN.
   *     The service that builds the role already refuses to store an ungrantable permission,
   *     and filters again on read — so a stale row from a plan that has since changed cannot
   *     be the thing that lets somebody through.
   *
   *  2. IT DEGRADES TO SAFE. If the operator is no longer on a plan with custom roles, or the
   *     role was switched off, or the lookup fails for any reason at all, the answer is the
   *     BASE role. Never nothing, and never more. A person whose custom role disappears becomes
   *     a Support Agent again — not a person with no permissions, and certainly not an admin.
   */
  async effectivePermissionsFor(user: {
    role: Role | string;
    operatorId?: string | null;
    customRoleId?: string | null;
  }): Promise<string[]> {
    const base = await this.effectivePermissions(user.role as Role, user.operatorId ?? null);

    if (!user.customRoleId || !user.operatorId || !this.customRoles) return base;

    try {
      const extra = await this.customRoles.permissionsFor(user.operatorId, user.customRoleId);
      if (!extra?.length) return base;
      return [...new Set([...base, ...extra])];
    } catch {
      // A custom role that cannot be read is a custom role that does not apply. Falling back
      // to the base role is the only safe answer: the alternative is either locking someone
      // out of their job, or letting them through on a permission we could not verify.
      return base;
    }
  }

  /**
   * The guard's one question: may this person do this?
   *
   * Same semantics as `can()` — it just resolves the custom role first. Keeping the comparison
   * inside `hasPermission` matters: the guard must not re-implement "any of" vs "all of" and
   * get it subtly wrong.
   */
  async canWithCustomRole(
    user: { role: Role | string; operatorId?: string | null; customRoleId?: string | null },
    required: string[],
  ): Promise<boolean> {
    const effective = await this.effectivePermissionsFor(user);
    return hasPermission(effective, required);
  }

  /** Wired at boot. Optional so RbacService keeps working in tests that do not need IAM. */
  private customRoles?: { permissionsFor(operatorId: string, roleId: string | null): Promise<string[] | null> };
  registerCustomRoles(provider: { permissionsFor(operatorId: string, roleId: string | null): Promise<string[] | null> }): void {
    this.customRoles = provider;
  }

  // ---- Catalog & override management ----
  catalog() {
    return PERMISSION_CATALOG;
  }

  listOverrides(operatorId: string) {
    return this.overrideRepo.find({ where: { operatorId }, order: { role: 'ASC' } });
  }

  async setOverride(operatorId: string, role: Role, permissionKey: string, granted: boolean): Promise<PermissionOverride> {
    let row = await this.overrideRepo.findOne({ where: { operatorId, role, permissionKey } });
    if (row) row.granted = granted;
    else row = this.overrideRepo.create({ operatorId, role, permissionKey, granted });
    const saved = await this.overrideRepo.save(row);
    this.invalidate(operatorId, role);
    return saved;
  }

  async clearOverride(operatorId: string, role: Role, permissionKey: string): Promise<{ cleared: true }> {
    await this.overrideRepo.delete({ operatorId, role, permissionKey });
    this.invalidate(operatorId, role);
    return { cleared: true };
  }
}
