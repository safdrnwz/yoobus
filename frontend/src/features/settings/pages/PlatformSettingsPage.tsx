import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Button, Card, CardBody, CardHeader, Input, Select, Skeleton, Switch, Tabs } from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import { platformConfigApi } from '../api/settings.api';
import { SETTINGS_SCHEMA, type SettingDef } from '@/core/api/generated/settings-schema';
import { humanise } from '@/core/utils/format';

/**
 * Global settings — every namespace, not just Appearance.
 *
 * Appearance already had a screen. The other seven namespaces did not: GENERAL,
 * LOCALIZATION, SECURITY, BOOKING, PAYMENT, NOTIFICATION and RETENTION — 35 settings,
 * including every money setting the platform has (commission, GST, TDS/TCS, insurance,
 * setup fee) — were live on the API and completely invisible in the product.
 *
 * The form is not hand-written. It renders from SETTINGS_SCHEMA, which is generated from
 * the backend's own schema, so adding a setting on the server makes it appear here with the
 * right control and the right validation. There is no second list to keep in step.
 */

/** Namespaces this screen owns. Appearance keeps its richer, purpose-built editor. */
const NAMESPACES = Object.keys(SETTINGS_SCHEMA).filter((ns) => ns !== 'APPEARANCE').sort();

const NAMESPACE_BLURB: Record<string, string> = {
  GENERAL: 'Who you are: the name, the support contacts, the registered address.',
  LOCALIZATION: 'Currency, timezone, language and date format for the whole platform.',
  SECURITY: 'Password rules, session length, lockout policy, MFA.',
  BOOKING: 'How long a seat is held, how far ahead people can book, cancellation windows.',
  PAYMENT: 'Commission, GST, TDS/TCS, insurance and setup fees. Changing these changes what everyone is charged.',
  NOTIFICATION: 'Which channels are switched on platform-wide.',
  RETENTION: 'How long data is kept before it is purged.',
};

/** The money namespace deserves a warning: these numbers are billed to real operators. */
const DANGEROUS = new Set(['PAYMENT', 'SECURITY']);

function labelFor(def: SettingDef): string {
  return humanise(def.key);
}

function hintFor(def: SettingDef): string | undefined {
  switch (def.type) {
    case 'rate':
      return 'A rate, 0–100 (percent).';
    case 'positiveInt':
      return 'A whole number greater than zero.';
    case 'stateCode':
      return 'Two-digit GST state code, e.g. 07 for Delhi.';
    case 'timezone':
      return 'An IANA zone, e.g. Asia/Kolkata.';
    case 'currency':
      return 'An ISO currency code, e.g. INR.';
    case 'language':
      return 'A BCP-47 tag, e.g. en-IN.';
    default:
      return undefined;
  }
}

function NamespaceForm({ namespace }: { namespace: string }) {
  const queryClient = useQueryClient();
  const defs = SETTINGS_SCHEMA[namespace] ?? [];

  const saved = useQuery({
    queryKey: ['settings', namespace],
    queryFn: () => platformConfigApi.effective(namespace as never),
  });

  const [draft, setDraft] = useState<Record<string, unknown>>({});

  // Reset the draft whenever the server's view of the world changes.
  useEffect(() => {
    if (saved.data) setDraft({ ...saved.data });
  }, [saved.data]);

  const dirty = useMemo(() => {
    if (!saved.data) return false;
    return defs.some((d) => String(draft[d.key] ?? '') !== String((saved.data as Record<string, unknown>)[d.key] ?? ''));
  }, [defs, draft, saved.data]);

  const save = useMutation({
    // Only the keys that actually changed. Sending the whole set makes every save look like
    // an edit of everything in the audit trail, which makes the audit trail useless.
    mutationFn: () => {
      const changed: Record<string, unknown> = {};
      for (const d of defs) {
        const before = (saved.data as Record<string, unknown> | undefined)?.[d.key];
        if (String(draft[d.key] ?? '') !== String(before ?? '')) changed[d.key] = draft[d.key];
      }
      return platformConfigApi.setNamespace(namespace as never, changed);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', namespace] });
      toast.success(`${humanise(namespace)} saved.`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Those settings could not be saved.'),
  });

  const reset = useMutation({
    mutationFn: () => platformConfigApi.resetNamespace(namespace as never),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', namespace] });
      toast.success(`${humanise(namespace)} restored to defaults.`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Those settings could not be reset.'),
  });

  if (saved.isPending) return <Skeleton className="h-64 w-full" />;

  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Card>
      <CardHeader
        title={humanise(namespace)}
        description={NAMESPACE_BLURB[namespace]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={() => reset.mutate()}
              isLoading={reset.isPending}
            >
              Restore defaults
            </Button>
            <Button
              size="sm"
              leftIcon={<Save className="h-4 w-4" />}
              onClick={() => save.mutate()}
              isLoading={save.isPending}
              disabled={!dirty}
            >
              Save
            </Button>
          </div>
        }
      />
      <CardBody>
        {DANGEROUS.has(namespace) && (
          <Alert tone="warning" title="These apply to everyone" className="mb-5">
            {namespace === 'PAYMENT'
              ? 'These rates decide what every operator and passenger is charged. A wrong figure here bills real money.'
              : 'These rules apply to every account on the platform, including your own.'}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {defs.map((def) => {
            const value = draft[def.key];

            if (def.type === 'boolean') {
              return (
                <div key={def.key} className="sm:col-span-2">
                  <Switch
                    label={labelFor(def)}
                    description={hintFor(def)}
                    checked={Boolean(value)}
                    onChange={(next) => set(def.key, next)}
                  />
                </div>
              );
            }

            if (def.type === 'positiveInt' || def.type === 'number' || def.type === 'rate') {
              return (
                <Input
                  key={def.key}
                  label={labelFor(def)}
                  hint={hintFor(def)}
                  type="number"
                  min={def.type === 'positiveInt' ? 1 : 0}
                  max={def.type === 'rate' ? 100 : undefined}
                  step={def.type === 'rate' || def.type === 'number' ? '0.01' : '1'}
                  value={value === undefined || value === null ? '' : String(value)}
                  onChange={(event) =>
                    set(def.key, event.target.value === '' ? undefined : Number(event.target.value))
                  }
                />
              );
            }

            return (
              <Input
                key={def.key}
                label={labelFor(def)}
                hint={hintFor(def)}
                type={def.type === 'email' ? 'email' : 'text'}
                value={value === undefined || value === null ? '' : String(value)}
                onChange={(event) => set(def.key, event.target.value)}
              />
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export function PlatformSettingsPage() {
  const [active, setActive] = useState(NAMESPACES[0]);

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="The knobs that apply to the whole of Yoo Bus. Appearance has its own screen."
        breadcrumbs={[{ label: 'Settings' }, { label: 'Platform' }]}
      />

      <Tabs
        tabs={NAMESPACES.map((ns) => ({
          id: ns,
          label: humanise(ns),
          count: SETTINGS_SCHEMA[ns]?.length ?? 0,
        }))}
        active={active}
        onChange={setActive}
        className="mb-5"
      />

      <NamespaceForm key={active} namespace={active} />
    </>
  );
}
