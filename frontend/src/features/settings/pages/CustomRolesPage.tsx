import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Skeleton } from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import { http } from '@/core/api/http-client';
import { humanise } from '@/core/utils/format';

/**
 * IAM — the roles an OPERATOR invents.
 *
 * The built-in roles cover most bus companies. They do not cover all of them: a large operator
 * has a Booking Operator who may sell but not refund, a Counter Clerk tied to one counter, a
 * Conductor who may board and nothing else. Forcing those into "Support Agent" hands a counter
 * clerk the power to cancel any booking on the network.
 *
 * Enterprise only, capped at five, and every checkbox on this screen is a permission the server
 * has already confirmed this operator may grant — the list comes from `/custom-roles/grantable`,
 * so there is never a box you can tick that will be refused on save.
 */

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
}

interface Grantable {
  key: string;
  label: string;
  group: string;
}

const rolesApi = {
  grantable: () => http.get<Grantable[]>('/custom-roles/grantable'),
  list: () => http.get<CustomRole[]>('/custom-roles'),
  create: (body: { name: string; description?: string; permissions: string[] }) =>
    http.post<CustomRole>('/custom-roles', body),
  update: (id: string, body: { name?: string; description?: string; permissions?: string[] }) =>
    http.patch<CustomRole>(`/custom-roles/${id}`, body),
  remove: (id: string) => http.delete<unknown>(`/custom-roles/${id}`),
};

export function CustomRolesPage() {
  const queryClient = useQueryClient();

  const grantable = useQuery({ queryKey: ['grantable-permissions'], queryFn: () => rolesApi.grantable() });
  const roles = useQuery({ queryKey: ['custom-roles'], queryFn: () => rolesApi.list() });

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);

  /**
   * The plan gate, surfaced honestly.
   *
   * A 403 from `/custom-roles` means the operator is not on Enterprise. Showing them an empty
   * screen would be a lie by omission — they would think the feature was broken. Tell them what
   * it is, and what it costs.
   */
  const gated =
    (roles.error instanceof ApiError && roles.error.code === 'FEATURE_NOT_IN_PLAN') ||
    (grantable.error instanceof ApiError && grantable.error.code === 'FEATURE_NOT_IN_PLAN');

  const byGroup = useMemo(() => {
    const out = new Map<string, Grantable[]>();
    for (const p of grantable.data ?? []) {
      out.set(p.group, [...(out.get(p.group) ?? []), p]);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [grantable.data]);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? rolesApi.update(editing, { name, permissions: [...selected] })
        : rolesApi.create({ name, permissions: [...selected] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success(editing ? 'Role updated.' : 'Role created.');
      setName('');
      setSelected(new Set());
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That role could not be saved.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Role deleted.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That role could not be deleted.'),
  });

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const edit = (role: CustomRole) => {
    setEditing(role.id);
    setName(role.name);
    setSelected(new Set(role.permissions));
  };

  if (gated) {
    return (
      <>
        <PageHeader
          title="Custom roles"
          description="Design your own roles, with exactly the permissions you choose."
          breadcrumbs={[{ label: 'Administration' }, { label: 'Custom roles' }]}
        />
        <EmptyState
          icon={<Lock className="h-6 w-6" aria-hidden />}
          title="Custom roles are an Enterprise feature"
          description={
            'The built-in roles cover most operators. If you need a Counter Clerk who can sell but not refund, ' +
            'or a Conductor who can board and nothing else, Enterprise lets you design up to five roles of your own — ' +
            'built from the same permissions you already hold, and never more.'
          }
        />
      </>
    );
  }

  if (roles.isPending || grantable.isPending) return <Skeleton className="h-96 w-full" />;

  const list = roles.data ?? [];
  const inactive = list.filter((r) => !r.isActive);

  return (
    <>
      <PageHeader
        title="Custom roles"
        description="Up to five roles of your own, built from the permissions you already hold."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Custom roles' }]}
        actions={<Badge tone={list.length >= 5 ? 'warning' : 'primary'}>{list.length} of 5</Badge>}
      />

      {inactive.length > 0 && (
        <Alert tone="warning" title="Some roles are switched off" className="mb-4">
          {inactive.length} role{inactive.length > 1 ? 's are' : ' is'} not being applied — your plan no longer
          includes custom roles. Nothing has been deleted: the people on them fall back to their base role, and
          everything comes back exactly as it was if you upgrade again.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {list.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-6 w-6" aria-hidden />}
              title="No roles yet"
              description="Pick the permissions on the right and give the role a name."
            />
          ) : (
            list.map((role) => (
              <Card key={role.id} className={editing === role.id ? 'ring-2 ring-primary' : ''}>
                <CardBody className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => edit(role)} className="text-left font-medium text-ink">
                      {role.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove.mutate(role.id)}
                      isLoading={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                    </Button>
                  </div>
                  <p className="text-step--1 text-ink-muted">
                    {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                  </p>
                  {!role.isActive && <Badge tone="warning">Not applied</Badge>}
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader
            title={editing ? 'Edit role' : 'New role'}
            description="Every permission here is one you already hold. You cannot grant more than you have."
            actions={
              <div className="flex gap-2">
                {editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setName('');
                      setSelected(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => save.mutate()}
                  isLoading={save.isPending}
                  disabled={!name.trim() || selected.size === 0}
                >
                  {editing ? 'Save' : 'Create role'}
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <Input
              label="Role name"
              placeholder="Counter Clerk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              containerClassName="max-w-sm"
            />

            <p className="text-step--1 text-ink-muted">
              {selected.size} permission{selected.size === 1 ? '' : 's'} selected
            </p>

            <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
              {byGroup.map(([group, perms]) => (
                <div key={group}>
                  <p className="mb-1.5 text-step--1 font-medium text-ink">{humanise(group)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => {
                      const on = selected.has(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => toggle(p.key)}
                          aria-pressed={on}
                          className={[
                            'rounded-control border-hair px-2.5 py-1 text-step--1 transition-colors duration-motion',
                            on
                              ? 'border-primary bg-primary text-primary-fg'
                              : 'border-line bg-surface text-ink hover:border-primary',
                          ].join(' ')}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
