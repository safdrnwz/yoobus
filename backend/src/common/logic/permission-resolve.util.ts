/**
 * Pure, testable resolution of effective permissions:
 * role defaults, refined by per-operator overrides (grant adds, revoke removes).
 */
export interface PermissionOverrideLike {
  permissionKey: string;
  granted: boolean;
}

export function resolveEffectivePermissions(base: string[], overrides: PermissionOverrideLike[]): string[] {
  const set = new Set(base);
  for (const o of overrides) {
    if (o.granted) set.add(o.permissionKey);
    else set.delete(o.permissionKey);
  }
  return Array.from(set).sort();
}

export function hasPermission(effective: string[], required: string[]): boolean {
  return required.every((perm) => effective.includes(perm));
}
