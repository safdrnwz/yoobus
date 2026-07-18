import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type FieldValues } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Plus, Search } from 'lucide-react';
import { PageHeader, type Crumb } from '@/components/layout/PageHeader';
import {
  Button, Card, ConfirmDialog, DataTable, Input, Modal, RowActions, Select, Switch, Textarea,
  type Column,
} from '@/components/ui';
import { Can } from '@/core/rbac/Guard';
import { ApiError } from '@/core/api/api-error';
import { useAuthStore } from '@/core/auth/auth.store';
import { usePagination, useDisclosure } from '@/core/hooks';
import { downloadCsv } from '@/core/utils/download';

/* ------------------------------------------------------------------ *
 * A resource is a backend collection plus the things you can do to it.
 *
 * Most screens in an operations console are the same screen: a filtered list, a create
 * form, and a few row actions gated on permissions. Writing forty bespoke versions of
 * that invites forty subtly different behaviours. Describing them instead means the
 * loading, empty, error, permission and toast behaviour is identical everywhere, and a
 * new backend module becomes a config object rather than a new screen.
 *
 * Anything that genuinely isn't this shape — the seat map, the boarding scanner, the
 * theme studio — is written by hand and doesn't use this at all.
 * ------------------------------------------------------------------ */

export type FieldKind =
  | 'text' | 'number' | 'email' | 'date' | 'datetime-local' | 'textarea' | 'select' | 'switch'
  /** A list of plain strings, typed comma-separated. */
  | 'csv'
  /** Pick several from a fixed set — days of the week, amenities, permissions. */
  | 'multiselect'
  /** A nested object — a plan's pricing, a plan's limits. */
  | 'group'
  /** A list of nested objects — a route's stops, an invoice's items, a journal's lines. */
  | 'repeater';

export interface FormField {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: Array<{ value: string | number; label: string }>;
  /** For 'multiselect' and 'csv': the values are sent as an array, not a string. */
  valueType?: 'string' | 'number';
  /**
   * For 'group' and 'repeater': the shape of the nested object.
   *
   * A route without stops is not a route, and an invoice without line items is not an
   * invoice — yet those forms had no way to collect either, so their Save buttons could
   * never succeed. These are generated from the nested DTO, like everything else.
   */
  subFields?: FormField[];
  /** Fields not in the create form (server-assigned, or edit-only). */
  editOnly?: boolean;
}

export interface RowAction<T> {
  label: string;
  /**
   * Called with the row and, if `fields` are declared, whatever the user typed.
   *
   * Some actions genuinely need input — "Deploy backup" needs to know WHICH bus, and
   * "Generate trips" needs a date range. Those actions used to call the server with `{}`,
   * which the server rejected every single time. `fields` gives them somewhere to ask.
   */
  run: (row: T, input: Record<string, unknown>) => Promise<unknown>;
  /** Inputs collected before `run` fires. Declaring any of these opens a small form. */
  fields?: FormField[];
  /** Destructive actions get a confirmation step and the message shown here. */
  confirm?: (row: T) => string;
  permission?: string;
  /** Hide the action for rows it can't apply to — a paid settlement can't be paid again. */
  visible?: (row: T) => boolean;
  tone?: 'primary' | 'outline' | 'ghost' | 'danger';
}

/**
 * `P` is the CREATE/UPDATE payload — the DTO the backend actually validates against.
 *
 * It used to be hardcoded to `Record<string, unknown>`, which meant a screen could send
 * any object at all and TypeScript would nod along; you found out it was wrong when the
 * server returned 400. Now the payload type comes from the generated backend DTOs, so a
 * missing or misspelt key is a compile error.
 */
export interface ResourceConfig<T, P = Record<string, unknown>> {
  /** Query key root and the noun used in copy. */
  key: string;
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  singular: string;

  list: (params: Record<string, unknown>) => Promise<T[]>;
  create?: (body: P) => Promise<unknown>;
  /** When set, the "New" button navigates to this route (a full page) instead of opening a modal. */
  createHref?: string;
  update?: (id: string, body: P) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;

  rowId: (row: T) => string;
  columns: Column<T>[];
  fields?: FormField[];
  actions?: RowAction<T>[];

  /** Permissions that gate the whole screen's write paths. */
  createPermission?: string;
  /** Extra filters rendered next to the search box. */
  filters?: Array<{ name: string; label: string; options: Array<{ value: string; label: string }> }>;
  /** Turn off the search box for endpoints that don't accept one. */
  searchable?: boolean;
  emptyDescription?: string;
  /** Anything to render above the table — a stat strip, an alert. */
  banner?: ReactNode;
}

export function ResourcePage<T, P = Record<string, unknown>>({ config }: { config: ResourceConfig<T, P> }) {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const { page, setPage, limit, search, setSearch, params } = usePagination();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null>(null);
  const formModal = useDisclosure();
  const [pendingAction, setPendingAction] = useState<{ action: RowAction<T>; row: T } | null>(null);
  /** An action that needs input (e.g. WHICH backup bus) opens its own little form. */
  const [inputAction, setInputAction] = useState<{ action: RowAction<T>; row: T } | null>(null);
  const actionForm = useForm<FieldValues>();

  const queryParams = useMemo(
    () => ({ ...params, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }),
    [params, filters],
  );

  const query = useQuery({
    queryKey: [config.key, queryParams],
    queryFn: () => config.list(queryParams),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.key] });

  const form = useForm<FieldValues>();

  const saveMutation = useMutation({
    mutationFn: async (values: FieldValues) => {
      // Empty strings are the browser's idea of "not filled in", not the server's.
      const body = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
      );
      if (editing && config.update) return config.update(config.rowId(editing), body as P);
      if (config.create) return config.create(body as P);
      throw new Error('This resource is read-only.');
    },
    onSuccess: async () => {
      await invalidate();
      formModal.close();
      setEditing(null);
      form.reset();
      toast.success(editing ? `${config.singular} updated.` : `${config.singular} created.`);
    },
    onError: (error) => {
      const apiError = error instanceof ApiError ? error : null;

      // Put the server's complaint under the field it is complaining about. The server is
      // the only thing that knows the real rules — length limits, formats, uniqueness — so
      // its message is the accurate one, and it belongs where the user is looking.
      const fieldErrors = apiError?.fieldErrors ?? {};
      const known = Object.entries(fieldErrors).filter(([name]) =>
        formFields.some((f) => f.name === name),
      );
      for (const [name, message] of known) {
        form.setError(name, { type: 'server', message });
      }

      // Anything the form has no input for still needs saying out loud — otherwise the user
      // sees a Save that does nothing and no explanation anywhere.
      const unattached = Object.entries(fieldErrors).filter(
        ([name]) => !formFields.some((f) => f.name === name),
      );
      if (known.length === 0 || unattached.length > 0) {
        toast.error(
          unattached[0]?.[1] ?? apiError?.fieldMessages[0] ?? apiError?.message ?? 'That could not be saved.',
        );
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, row, input }: { action: RowAction<T>; row: T; input?: Record<string, unknown> }) =>
      action.run(row, input ?? {}),
    onSuccess: async (_data, variables) => {
      await invalidate();
      setPendingAction(null);
      setInputAction(null);
      actionForm.reset({});
      toast.success(`${variables.action.label} — done.`);
    },
    onError: (error) => {
      setPendingAction(null);
      toast.error(error instanceof ApiError ? error.message : 'That action did not go through.');
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({});
    formModal.open();
  };

  const openEdit = (row: T) => {
    setEditing(row);
    form.reset(row as FieldValues);
    formModal.open();
  };

  const runAction = (action: RowAction<T>, row: T) => {
    if (action.fields?.length) {
      actionForm.reset({});
      setInputAction({ action, row });
    } else if (action.confirm) {
      setPendingAction({ action, row });
    } else {
      actionMutation.mutate({ action, row });
    }
  };

  const canCreate = (Boolean(config.create) || Boolean(config.createHref)) && (!config.createPermission || can(config.createPermission));

  const visibleActions = (row: T) =>
    (config.actions ?? []).filter(
      (action) => (!action.permission || can(action.permission)) && (!action.visible || action.visible(row)),
    );

  // The action column is appended rather than declared, so a config never repeats it.
  const columns = useMemo<Column<T>[]>(() => {
    const hasActions = (config.actions?.length ?? 0) > 0 || Boolean(config.update);
    if (!hasActions) return config.columns;

    return [
      ...config.columns,
      {
        id: '__actions',
        header: '',
        align: 'right',
        cell: (row) => {
          const actions = visibleActions(row);
          const canEdit = Boolean(config.update) && (!config.createPermission || can(config.createPermission));
          if (actions.length === 0 && !canEdit) return null;

          return (
            <RowActions>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
              )}
              {actions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant={action.tone ?? 'outline'}
                  isLoading={
                    actionMutation.isPending &&
                    actionMutation.variables?.action.label === action.label &&
                    config.rowId(actionMutation.variables.row) === config.rowId(row)
                  }
                  onClick={() => runAction(action, row)}
                >
                  {action.label}
                </Button>
              ))}
            </RowActions>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, can, actionMutation.isPending, actionMutation.variables]);

  const formFields = (config.fields ?? []).filter((field) => (editing ? true : !field.editOnly));

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={config.breadcrumbs}
        actions={
          <>
            {query.data && query.data.length > 0 && (
              <Button
                variant="outline"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => downloadCsv(query.data as Record<string, unknown>[], `${config.key}.csv`)}
              >
                Export CSV
              </Button>
            )}
            {canCreate &&
              (config.createHref ? (
                <Link to={config.createHref}>
                  <Button leftIcon={<Plus className="h-4 w-4" />}>New {config.singular.toLowerCase()}</Button>
                </Link>
              ) : (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  New {config.singular.toLowerCase()}
                </Button>
              ))}
          </>
        }
      />

      {config.banner}

      {(config.searchable !== false || config.filters) && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {config.searchable !== false && (
            <Input
              containerClassName="w-full max-w-xs"
              placeholder={`Search ${config.title.toLowerCase()}`}
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={`Search ${config.title}`}
            />
          )}
          {config.filters?.map((filter) => (
            <Select
              key={filter.name}
              label={filter.label}
              containerClassName="w-44"
              placeholder="Any"
              options={filter.options}
              value={filters[filter.name] ?? ''}
              onChange={(event) => {
                setFilters((current) => ({ ...current, [filter.name]: event.target.value }));
                setPage(1);
              }}
            />
          ))}
        </div>
      )}

      <DataTable<T>
        data={query.data}
        columns={columns}
        rowKey={config.rowId}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        pagination={{ page, limit, onPageChange: setPage }}
        empty={{
          title: `No ${config.title.toLowerCase()} yet`,
          description: config.emptyDescription,
          action: canCreate
            ? config.createHref
              ? <Link to={config.createHref}><Button>New {config.singular.toLowerCase()}</Button></Link>
              : <Button onClick={openCreate}>New {config.singular.toLowerCase()}</Button>
            : undefined,
        }}
      />

      <Modal
        isOpen={formModal.isOpen}
        onClose={() => {
          formModal.close();
          setEditing(null);
        }}
        title={editing ? `Edit ${config.singular.toLowerCase()}` : `New ${config.singular.toLowerCase()}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={formModal.close} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit((values) => saveMutation.mutate(values))}
              isLoading={saveMutation.isPending}
            >
              {editing ? 'Save changes' : `Create ${config.singular.toLowerCase()}`}
            </Button>
          </>
        }
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          {formFields.map((field) => {
            const error = form.formState.errors[field.name]?.message as string | undefined;
            const registration = form.register(field.name, {
              required: field.required ? `${field.label} is required.` : false,
              valueAsNumber: field.kind === 'number',
            });

            if (field.kind === 'group' && field.subFields?.length) {
              return (
                <fieldset key={field.name} className="sm:col-span-2 rounded-card border-hair border-line p-4">
                  <legend className="px-1 text-step--1 font-medium text-ink">{field.label}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field.subFields.map((sub) => (
                      <Input
                        key={sub.name}
                        label={sub.label}
                        type={sub.kind === 'number' ? 'number' : 'text'}
                        hint={sub.hint}
                        required={sub.required}
                        placeholder={sub.placeholder}
                        {...form.register(`${field.name}.${sub.name}`, {
                          required: sub.required ? `${sub.label} is required.` : false,
                          valueAsNumber: sub.kind === 'number',
                        })}
                      />
                    ))}
                  </div>
                </fieldset>
              );
            }

            if (field.kind === 'repeater' && field.subFields?.length) {
              const subs = field.subFields;
              const rows = (form.watch(field.name) as Array<Record<string, unknown>> | undefined) ?? [];
              const setRows = (next: Array<Record<string, unknown>>) =>
                form.setValue(field.name, next, { shouldValidate: true });

              return (
                <div key={field.name} className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-step--1 font-medium text-ink">
                      {field.label}
                      {field.required && <span className="ml-0.5 text-danger">*</span>}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRows([...rows, Object.fromEntries(subs.map((sf) => [sf.name, '']))])}
                    >
                      Add
                    </Button>
                  </div>

                  {rows.length === 0 ? (
                    <p className="rounded-control border-hair border-dashed border-line p-4 text-center text-step--1 text-ink-muted">
                      {field.hint ?? 'Nothing added yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((row, index) => (
                        <div
                          key={index}
                          className="grid items-end gap-2 rounded-control border-hair border-line p-3"
                          style={{ gridTemplateColumns: `repeat(${subs.length}, minmax(0, 1fr)) auto` }}
                        >
                          {subs.map((sub) => (
                            <Input
                              key={sub.name}
                              label={sub.label}
                              type={sub.kind === 'number' ? 'number' : 'text'}
                              placeholder={sub.placeholder}
                              value={String(row[sub.name] ?? '')}
                              onChange={(event) => {
                                const next = [...rows];
                                next[index] = {
                                  ...next[index],
                                  [sub.name]:
                                    sub.kind === 'number'
                                      ? event.target.value === ''
                                        ? ''
                                        : Number(event.target.value)
                                      : event.target.value,
                                };
                                setRows(next);
                              }}
                            />
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => setRows(rows.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {error && <p className="mt-1 text-step--1 text-danger">{error}</p>}
                </div>
              );
            }

            if (field.kind === 'multiselect') {
              // A `number[]` or `string[]` the server expects as an array. Rendering it as a
              // text box (the old behaviour was to render nothing at all) means the value
              // arrives as a string and the server rejects the whole payload.
              const current = (form.watch(field.name) as Array<string | number> | undefined) ?? [];
              const toggle = (value: string | number) => {
                const has = current.some((v) => String(v) === String(value));
                const next = has
                  ? current.filter((v) => String(v) !== String(value))
                  : [...current, field.valueType === 'number' ? Number(value) : value];
                form.setValue(field.name, next, { shouldValidate: true });
              };
              return (
                <div key={field.name} className="sm:col-span-2">
                  <p className="mb-1.5 text-step--1 font-medium text-ink">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-danger">*</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((option) => {
                      const active = current.some((v) => String(v) === String(option.value));
                      return (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => toggle(option.value)}
                          aria-pressed={active}
                          className={[
                            'rounded-control border-hair px-3 py-1.5 text-step--1 transition-colors duration-motion',
                            active
                              ? 'border-primary bg-primary text-primary-fg'
                              : 'border-line bg-surface text-ink hover:border-primary',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {field.hint && <p className="mt-1 text-step--1 text-ink-muted">{field.hint}</p>}
                  {error && <p className="mt-1 text-step--1 text-danger">{error}</p>}
                </div>
              );
            }

            if (field.kind === 'csv') {
              // Typed as text, sent as an array — the server wants string[].
              const current = (form.watch(field.name) as string[] | string | undefined) ?? [];
              const asText = Array.isArray(current) ? current.join(', ') : String(current ?? '');
              return (
                <Input
                  key={field.name}
                  label={field.label}
                  hint={field.hint ?? 'Comma-separated.'}
                  error={error}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="sm:col-span-2"
                  value={asText}
                  onChange={(event) =>
                    form.setValue(
                      field.name,
                      event.target.value
                        .split(',')
                        .map((part) => part.trim())
                        .filter(Boolean),
                      { shouldValidate: true },
                    )
                  }
                />
              );
            }

            if (field.kind === 'switch') {
              return (
                <div key={field.name} className="sm:col-span-2">
                  <Switch
                    label={field.label}
                    description={field.hint}
                    checked={Boolean(form.watch(field.name))}
                    onChange={(value) => form.setValue(field.name, value)}
                  />
                </div>
              );
            }

            if (field.kind === 'textarea') {
              return (
                <Textarea
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="sm:col-span-2"
                  {...registration}
                />
              );
            }

            if (field.kind === 'select') {
              return (
                <Select
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                  placeholder="Choose one"
                  options={(field.options ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
                  {...registration}
                />
              );
            }

            return (
              <Input
                key={field.name}
                label={field.label}
                hint={field.hint}
                error={error}
                required={field.required}
                placeholder={field.placeholder}
                type={field.kind ?? 'text'}
                {...registration}
              />
            );
          })}
        </form>
      </Modal>

      {/* Actions that need input — "Deploy backup" must know WHICH bus, "Generate trips"
          needs a date range. Before this existed, those actions posted `{}` and the server
          rejected them every time. */}
      <Modal
        isOpen={Boolean(inputAction)}
        onClose={() => setInputAction(null)}
        title={inputAction?.action.label ?? ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInputAction(null)} disabled={actionMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={actionForm.handleSubmit((values) => {
                if (inputAction) actionMutation.mutate({ ...inputAction, input: values });
              })}
              isLoading={actionMutation.isPending}
            >
              {inputAction?.action.label}
            </Button>
          </div>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2">
          {(inputAction?.action.fields ?? []).map((field) => {
            const error = actionForm.formState.errors[field.name]?.message as string | undefined;
            const registration = actionForm.register(field.name, {
              required: field.required ? `${field.label} is required.` : false,
              valueAsNumber: field.kind === 'number',
            });
            if (field.kind === 'select') {
              return (
                <Select
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                  placeholder={field.placeholder}
                  options={(field.options ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
                  {...registration}
                />
              );
            }
            if (field.kind === 'textarea') {
              return (
                <Textarea
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="sm:col-span-2"
                  {...registration}
                />
              );
            }
            return (
              <Input
                key={field.name}
                label={field.label}
                type={field.kind ?? 'text'}
                hint={field.hint}
                error={error}
                required={field.required}
                placeholder={field.placeholder}
                {...registration}
              />
            );
          })}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={() => pendingAction && actionMutation.mutate(pendingAction)}
        isLoading={actionMutation.isPending}
        title={pendingAction ? `${pendingAction.action.label}?` : ''}
        message={pendingAction?.action.confirm?.(pendingAction.row) ?? ''}
        confirmLabel={pendingAction?.action.label}
      />
    </>
  );
}

/** Small helper so a config file reads as data rather than as generics. */
export function defineResource<T, P = Record<string, unknown>>(config: ResourceConfig<T, P>): ResourceConfig<T, P> {
  return config;
}

export { Can };
