import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Minus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, Skeleton, StatusBadge, Switch, Tabs,
} from '@/components/ui';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import type { Column } from '@/components/ui/DataTable';
import { Permission } from '@/core/rbac/permissions';
import { rbacApi } from '@/features/auth/api/auth.api';
import { platformConfigApi, type FeatureFlag } from '../api/settings.api';
import { channelsApi, maintenanceApi, platformUsersApi } from '@/features/platform/api/platform.api';
import { PERMISSION_GROUP_LABELS } from '@/core/rbac/permissions';
import { OPERATOR_CREATABLE_ROLES, PLATFORM_CREATABLE_ROLES, ROLE_LABELS, Role } from '@/core/rbac/roles';
import { useAuthStore } from '@/core/auth/auth.store';
import { formatDateTime, formatRelative } from '@/core/utils/date';
import { humanise } from '@/core/utils/format';

import type { CreateMaintenanceDto, CreatePlatformStaffDto, CreateStaffDto, RegisterChannelDto } from '@/core/api/generated/dtos';
type Row = Record<string, unknown> & { id: string };

/* ---------------- Roles & permissions matrix ---------------- */

const MATRIX_ROLES: Role[] = [
  Role.SUPERADMIN,
  Role.ACCOUNTANT,
  Role.OPERATOR_ADMIN,
  Role.SUPPORT,
  Role.DRIVER,
  Role.CUSTOMER,
];

/**
 * The permission matrix.
 *
 * The catalog is the backend's, not ours — this screen renders what the server says the
 * defaults are, then layers the operator's own overrides on top. That means the matrix can
 * never drift from what is actually enforced.
 */
export function PermissionsPage() {
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);
  const canOverride = hasRole(Role.OPERATOR_ADMIN);

  const catalogQuery = useQuery({ queryKey: ['rbac', 'catalog'], queryFn: rbacApi.catalog });
  const overridesQuery = useQuery({
    queryKey: ['rbac', 'overrides'],
    queryFn: rbacApi.overrides,
    enabled: canOverride,
  });

  const [group, setGroup] = useState<string | null>(null);

  const groups = useMemo(() => Object.keys(catalogQuery.data ?? {}), [catalogQuery.data]);
  const activeGroup = group ?? groups[0];

  /** An override wins over the role default; otherwise the catalog decides. */
  const overrideFor = (role: string, key: string): boolean | null => {
    const match = overridesQuery.data?.find((o) => o.role === role && o.permissionKey === key);
    return match ? match.granted : null;
  };

  const setOverride = useMutation({
    mutationFn: (payload: { role: string; permissionKey: string; granted: boolean }) =>
      rbacApi.setOverride(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac'] });
      toast.success('Permission updated for this operator.');
    },
    onError: () => toast.error('That permission could not be changed.'),
  });

  if (catalogQuery.error) {
    return (
      <Card>
        <ErrorState error={catalogQuery.error} onRetry={catalogQuery.refetch} />
      </Card>
    );
  }

  const permissions = activeGroup ? (catalogQuery.data?.[activeGroup] ?? []) : [];

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="What each role can do. The server enforces this list — the console only reflects it."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles & permissions' }]}
      />

      {canOverride ? (
        <Alert tone="info" className="mb-gutter">
          Toggling a cell overrides the default for your operator only. Platform roles cannot be changed here.
        </Alert>
      ) : (
        <Alert tone="info" className="mb-gutter">
          This is a read-only view of the platform defaults.
        </Alert>
      )}

      {catalogQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Tabs
            className="mb-gutter"
            active={activeGroup ?? ''}
            onChange={setGroup}
            tabs={groups.map((id) => ({
              id,
              label: PERMISSION_GROUP_LABELS[id] ?? humanise(id),
              count: catalogQuery.data?.[id]?.length,
            }))}
          />

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-step-0">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken">
                    <th className="px-4 py-3 text-left text-step--1 font-medium uppercase tracking-wide text-ink-muted">
                      Permission
                    </th>
                    {MATRIX_ROLES.map((role) => (
                      <th
                        key={role}
                        className="px-3 py-3 text-center text-step--1 font-medium uppercase tracking-wide text-ink-muted"
                      >
                        {ROLE_LABELS[role].replace('Platform ', '').replace('Operator ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission) => (
                    <tr key={permission.key} className="border-b border-line last:border-0">
                      <td className="px-4 py-row">
                        <p className="text-ink">{permission.label}</p>
                        <p className="tabular text-step--1 text-ink-faint">{permission.key}</p>
                      </td>
                      {MATRIX_ROLES.map((role) => {
                        const byDefault = permission.roles.includes(role);
                        const override = overrideFor(role, permission.key);
                        const granted = override ?? byDefault;
                        // Only operator-scoped roles can be overridden by an operator admin.
                        const editable = canOverride && OPERATOR_CREATABLE_ROLES.includes(role);

                        return (
                          <td key={role} className="px-3 py-row text-center">
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                setOverride.mutate({ role, permissionKey: permission.key, granted: !granted })
                              }
                              aria-label={`${permission.label} for ${ROLE_LABELS[role]}`}
                              aria-pressed={granted}
                              className={[
                                'inline-flex h-6 w-6 items-center justify-center rounded-control transition-colors duration-motion',
                                granted ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-ink-faint',
                                editable ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
                                override !== null ? 'ring-1 ring-accent' : '',
                              ].join(' ')}
                            >
                              {granted ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {canOverride && (
            <p className="mt-3 text-step--1 text-ink-muted">
              A ring around a cell means your operator has overridden the platform default.
            </p>
          )}
        </>
      )}
    </>
  );
}

/* ---------------- Feature flags ---------------- */

export function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['flags'], queryFn: platformConfigApi.listFlags });

  const toggle = useMutation({
    mutationFn: (flag: FeatureFlag) =>
      platformConfigApi.upsertFlag({ key: flag.key, enabledGlobally: !flag.enabledGlobally }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['flags'] });
      toast.success('Flag updated.');
    },
    onError: () => toast.error('That flag could not be changed.'),
  });

  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Turn capabilities on and off across the platform, or for one operator at a time."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Feature flags' }]}
      />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (query.data?.length ?? 0) === 0 ? (
        <Card>
          <CardBody>
            <p className="py-12 text-center text-step-0 text-ink-muted">No flags have been defined yet.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {query.data!.map((flag) => (
            <Card key={flag.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="tabular font-medium text-ink">{flag.key}</p>
                    {Object.keys(flag.operatorOverrides ?? {}).length > 0 && (
                      <Badge tone="accent">{Object.keys(flag.operatorOverrides).length} operator override(s)</Badge>
                    )}
                  </div>
                  {flag.description && <p className="mt-0.5 text-step--1 text-ink-muted">{flag.description}</p>}
                  {flag.scheduledAt && (
                    <p className="mt-0.5 text-step--1 text-warning">
                      Turns on {formatRelative(flag.scheduledAt)} ({formatDateTime(flag.scheduledAt)})
                    </p>
                  )}
                </div>
                <Switch
                  checked={flag.enabledGlobally}
                  onChange={() => toggle.mutate(flag)}
                  label={flag.enabledGlobally ? 'On' : 'Off'}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Maintenance windows ---------------- */

export function MaintenancePage() {
  const current = useQuery({ queryKey: ['maintenance', 'current'], queryFn: maintenanceApi.current });

  return (
    <>
      {current.data && (
        <Alert tone="warning" title="Maintenance is scheduled" className="mb-gutter">
          The platform will be read-only during this window. Passengers cannot book while it runs.
        </Alert>
      )}

      <ResourcePage
        config={defineResource<Row, CreateMaintenanceDto>({
          key: 'maintenance',
          title: 'Maintenance',
          singular: 'Window',
          description: 'Planned downtime. Anyone signed in sees a banner before it starts.',
          breadcrumbs: [{ label: 'Administration' }, { label: 'Maintenance' }],
          list: () => maintenanceApi.list() as Promise<Row[]>,
          create: maintenanceApi.create,
          rowId: (row) => row.id,
          searchable: false,
          emptyDescription: 'No downtime is planned.',
          columns: [
            { id: 'reason', header: 'Reason', cell: (row) => <span className="font-medium text-ink">{String(row.reason ?? row.message ?? '—')}</span> },
            { id: 'from', header: 'Starts', cell: (row) => formatDateTime(row.startsAt as string) },
            { id: 'to', header: 'Ends', cell: (row) => formatDateTime(row.endsAt as string) },
            { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'SCHEDULED')} /> },
          ],
          fields: [
            { name: 'startAt', label: 'Start at', required: true },
            { name: 'endAt', label: 'End at', required: true },
            { name: 'message', label: 'Message', required: true },
          ],
          actions: [
            {
              label: 'Cancel',
              tone: 'danger',
              confirm: () => 'The window will be removed and the banner will stop showing.',
              run: (row) => maintenanceApi.remove(row.id),
            },
          ],
        })}
      />
    </>
  );
}

/* ---------------- Staff ---------------- */

export function StaffPage() {
  const hasRole = useAuthStore((state) => state.hasRole);

  /**
   * Two layers, two endpoints — and they are NOT interchangeable.
   *
   *   OPERATOR_ADMIN  -> POST /users/staff           its own Support / Drivers
   *   SUPERADMIN      -> POST /users/platform-staff  Yoo Bus's own Accountant / Support
   *
   * This screen used to send everything to /users/staff, which is OPERATOR_ADMIN-only. A
   * SuperAdmin therefore got a 403 and could not create Yoo Bus's own team at all.
   * Neither endpoint can mint a SUPERADMIN; the server refuses that regardless.
   */
  const isPlatform = hasRole(Role.SUPERADMIN);

  const creatableRoles = isPlatform ? PLATFORM_CREATABLE_ROLES : OPERATOR_CREATABLE_ROLES;

  const columns: Column<Row>[] = [
    { id: 'name', header: 'Name', cell: (row) => <span className="font-medium text-ink">{String(row.fullName ?? '—')}</span> },
    { id: 'email', header: 'Email', cell: (row) => String(row.email ?? '—') },
    { id: 'role', header: 'Role', cell: (row) => <Badge tone="primary">{ROLE_LABELS[row.role as Role] ?? humanise(String(row.role))}</Badge> },
    { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.isActive === false ? 'INACTIVE' : 'ACTIVE')} /> },
  ];

  const fields = [
    { name: 'fullName', label: 'Full name', required: true },
    { name: 'email', label: 'Email', kind: 'email' as const, required: true },
    { name: 'phone', label: 'Mobile', required: true },
    {
      name: 'role',
      label: 'Role',
      kind: 'select' as const,
      required: true,
      options: creatableRoles.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
      hint: 'They receive an email with a temporary password.',
    },
  ];

  if (isPlatform) {
    return (
      <ResourcePage
        config={defineResource<Row, CreatePlatformStaffDto>({
          key: 'platform-staff',
          title: 'Yoo Bus team',
          singular: 'Team member',
          description: "Yoo Bus's own people. They belong to no operator and sit above every one of them.",
          breadcrumbs: [{ label: 'Administration' }, { label: 'Yoo Bus team' }],
          list: (params) => platformUsersApi.listPlatformStaff(params) as unknown as Promise<Row[]>,
          create: platformUsersApi.createPlatformStaff,
          rowId: (row) => row.id,
          createPermission: Permission.CREATE_PLATFORM_USER,
          columns,
          fields,
        })}
      />
    );
  }

  return (
    <ResourcePage
      config={defineResource<Row, CreateStaffDto>({
        key: 'staff',
        title: 'Staff',
        singular: 'Person',
        description: 'Who can sign in to your operator, and what they are allowed to do.',
        breadcrumbs: [{ label: 'Administration' }, { label: 'Staff' }],
        list: (params) => platformUsersApi.listStaff(params) as unknown as Promise<Row[]>,
        create: platformUsersApi.createStaff,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_OPERATOR_STAFF,
        columns,
        fields,
      })}
    />
  );
}

/* ---------------- Sales channels ---------------- */

export function ChannelsPage() {
  return (
    <ResourcePage
      config={defineResource<Row, RegisterChannelDto>({
        key: 'channels',
        title: 'Sales channels',
        singular: 'Channel',
        description: 'Where your seats are sold — your own site, agents, and OTA partners.',
        breadcrumbs: [{ label: 'Administration' }, { label: 'Sales channels' }],
        list: () => channelsApi.list() as Promise<Row[]>,
        create: channelsApi.create,
        rowId: (row) => row.id,
        searchable: false,
        columns: [
          { id: 'name', header: 'Channel', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? '—')}</span> },
          { id: 'type', header: 'Type', cell: (row) => <Badge>{humanise(String(row.type ?? 'DIRECT'))}</Badge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'ACTIVE')} /> },
        ],
        fields: [
          { name: 'code', label: 'Code', required: true },
          { name: 'displayName', label: 'Display name', required: true },
          { name: 'channelCommissionRate', label: 'Channel commission rate', kind: 'number' },
        ],
      })}
    />
  );
}
