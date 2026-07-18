/**
 * Audit-log query filtering (government norms: SuperAdmin can review every actor's
 * actions across all operators). Pure and testable; the same predicate is used by
 * the DB query builder and by unit tests.
 */
export interface LogFilter {
  operatorId?: string | null;
  userId?: string;
  role?: string;
  method?: string;
  action?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface LogRecord {
  operatorId: string | null;
  userId: string | null;
  role: string | null;
  method: string;
  action: string | null;
  createdAt: string; // ISO
}

export function matchesFilter(log: LogRecord, f: LogFilter): boolean {
  if (f.operatorId !== undefined && log.operatorId !== f.operatorId) return false;
  if (f.userId !== undefined && log.userId !== f.userId) return false;
  if (f.role !== undefined && log.role !== f.role) return false;
  if (f.method !== undefined && log.method !== f.method) return false;
  if (f.action !== undefined && log.action !== f.action) return false;
  if (f.from !== undefined && new Date(log.createdAt).getTime() < new Date(f.from).getTime()) return false;
  if (f.to !== undefined && new Date(log.createdAt).getTime() > new Date(f.to).getTime()) return false;
  return true;
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; pageSize: number; total: number } {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(200, Math.max(1, Math.floor(pageSize) || 50));
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), page: safePage, pageSize: safeSize, total: items.length };
}
