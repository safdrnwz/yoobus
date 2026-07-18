import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Plug, Save, Trash2, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardBody } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Can } from '@/core/rbac/Guard';
import { Role } from '@/core/rbac/roles';
import { ApiError } from '@/core/api/api-error';
import { gpsApi, type GpsConfig } from '../api/gps.api';

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-step-0 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelClass = 'mb-1 block text-step--1 font-medium text-ink-muted';

const EMPTY: GpsConfig = { provider: '', apiBaseUrl: '', apiKey: '' };

function errText(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/**
 * GPS Integration.
 *
 * Operators connect their own GPS provider (Fleetx, LocoNav, Traccar, ...), map buses to
 * devices, and issue passenger tracking links. The SuperAdmin decides which providers are
 * available platform-wide. Every section is gated by the same permissions the backend enforces.
 */
export function GpsIntegrationPage() {
  const qc = useQueryClient();

  const providersQ = useQuery({ queryKey: ['gps', 'providers'], queryFn: gpsApi.listProviders });
  const configQ = useQuery({ queryKey: ['gps', 'config'], queryFn: gpsApi.getConfig });
  const devicesQ = useQuery({ queryKey: ['gps', 'devices'], queryFn: gpsApi.listDevices });

  const [form, setForm] = useState<GpsConfig>(EMPTY);
  useEffect(() => {
    if (configQ.data) setForm({ ...EMPTY, ...configQ.data });
  }, [configQ.data]);

  const enabledProviders = (providersQ.data ?? []).filter((p) => p.enabled);

  const saveConfig = useMutation({
    mutationFn: () => gpsApi.saveConfig(form),
    onSuccess: () => {
      toast.success('GPS configuration saved.');
      qc.invalidateQueries({ queryKey: ['gps', 'config'] });
    },
    onError: (e) => toast.error(errText(e, 'Could not save configuration.')),
  });

  const testConn = useMutation({
    mutationFn: gpsApi.testConnection,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['gps', 'config'] });
      r.ok ? toast.success(`Connected to ${r.provider}.`) : toast.error('Could not connect — check the credentials.');
    },
    onError: (e) => toast.error(errText(e, 'Connection test failed.')),
  });

  const setField = (k: keyof GpsConfig, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="GPS Integration"
        description="Connect a GPS provider, map buses to devices, and give passengers a live tracking link."
      />

      {/* SuperAdmin: enable/disable providers platform-wide */}
      <Can role={Role.SUPERADMIN}>
        <Card>
          <CardBody>
            <h2 className="mb-1 text-step-1 text-ink">Providers (platform)</h2>
            <p className="mb-4 text-step--1 text-ink-muted">
              Switch a provider on to let every operator configure it.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(providersQ.data ?? []).map((p) => (
                <ProviderToggle key={p.providerName} name={p.providerName} enabled={p.enabled} />
              ))}
            </div>
          </CardBody>
        </Card>
      </Can>

      {/* Operator: provider configuration */}
      <Can permission="CONFIGURE_GPS">
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-step-1 text-ink">Configuration</h2>
                <p className="text-step--1 text-ink-muted">Your GPS provider’s API credentials.</p>
              </div>
              {form.status && (
                <Badge tone={form.status === 'CONNECTED' ? 'success' : form.status === 'DISCONNECTED' ? 'danger' : 'neutral'} dot>
                  {form.status}
                </Badge>
              )}
            </div>

            {enabledProviders.length === 0 ? (
              <p className="text-step-0 text-ink-muted">
                No GPS provider is enabled yet. Ask the platform team to enable one.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Provider</label>
                  <select className={inputClass} value={form.provider} onChange={(e) => setField('provider', e.target.value)}>
                    <option value="">Select a provider…</option>
                    {enabledProviders.map((p) => (
                      <option key={p.providerName} value={p.providerName}>{p.providerName}</option>
                    ))}
                  </select>
                </div>
                <Field label="API Base URL" value={form.apiBaseUrl} onChange={(v) => setField('apiBaseUrl', v)} placeholder="https://api.provider.com" />
                <Field label="API Key" value={form.apiKey} onChange={(v) => setField('apiKey', v)} />
                <Field label="API Secret" value={form.apiSecret ?? ''} onChange={(v) => setField('apiSecret', v)} />
                <Field label="Client ID" value={form.clientId ?? ''} onChange={(v) => setField('clientId', v)} />
                <Field label="Access Token" value={form.accessToken ?? ''} onChange={(v) => setField('accessToken', v)} />
                <Field label="Webhook URL" value={form.webhookUrl ?? ''} onChange={(v) => setField('webhookUrl', v)} placeholder="https://your-app.com/webhook" />
              </div>
            )}

            {enabledProviders.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={saveConfig.isPending}
                  disabled={!form.provider || !form.apiBaseUrl || !form.apiKey}
                  onClick={() => saveConfig.mutate()}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Plug className="h-4 w-4" />}
                  isLoading={testConn.isPending}
                  disabled={!configQ.data}
                  onClick={() => testConn.mutate()}
                >
                  Test connection
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Operator: bus <-> device mapping */}
        <Card>
          <CardBody>
            <h2 className="mb-1 text-step-1 text-ink">Devices</h2>
            <p className="mb-4 text-step--1 text-ink-muted">Map each bus to its GPS device (IMEI).</p>

            <DeviceForm disabled={!configQ.data} />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-step-0">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Bus ID</th>
                    <th className="py-2 pr-4 font-medium">IMEI</th>
                    <th className="py-2 pr-4 font-medium">Device ID</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(devicesQ.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted">
                        No devices mapped yet.
                      </td>
                    </tr>
                  ) : (
                    (devicesQ.data ?? []).map((d) => <DeviceRow key={d.id} id={d.id} busId={d.busId} imei={d.imei} deviceId={d.deviceId} status={d.status} />)
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Can>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={labelClass}>{props.label}</label>
      <input
        className={inputClass}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function ProviderToggle({ name, enabled }: { name: string; enabled: boolean }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (next: boolean) => gpsApi.setProvider(name, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps', 'providers'] });
    },
    onError: (e) => toast.error(errText(e, 'Could not update the provider.')),
  });
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <span className="flex items-center gap-2 text-step-0 text-ink">
        <Wifi className="h-4 w-4 text-ink-muted" /> {name}
      </span>
      <input type="checkbox" checked={enabled} disabled={m.isPending} onChange={(e) => m.mutate(e.target.checked)} />
    </label>
  );
}

function DeviceForm({ disabled }: { disabled: boolean }) {
  const qc = useQueryClient();
  const [busId, setBusId] = useState('');
  const [imei, setImei] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const m = useMutation({
    mutationFn: () => gpsApi.mapDevice({ busId, imei, deviceId: deviceId || undefined }),
    onSuccess: () => {
      toast.success('Device mapped.');
      setBusId(''); setImei(''); setDeviceId('');
      qc.invalidateQueries({ queryKey: ['gps', 'devices'] });
    },
    onError: (e) => toast.error(errText(e, 'Could not map the device.')),
  });
  return (
    <div className="grid items-end gap-3 sm:grid-cols-4">
      <Field label="Bus ID" value={busId} onChange={setBusId} placeholder="bus uuid" />
      <Field label="IMEI" value={imei} onChange={setImei} />
      <Field label="Device ID" value={deviceId} onChange={setDeviceId} />
      <Button
        variant="primary"
        leftIcon={<MapPin className="h-4 w-4" />}
        isLoading={m.isPending}
        disabled={disabled || !busId || imei.length < 5}
        onClick={() => m.mutate()}
      >
        Map device
      </Button>
    </div>
  );
}

function DeviceRow(props: { id: string; busId: string; imei: string; deviceId: string | null; status: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => gpsApi.unmapDevice(props.id),
    onSuccess: () => {
      toast.success('Device removed.');
      qc.invalidateQueries({ queryKey: ['gps', 'devices'] });
    },
    onError: (e) => toast.error(errText(e, 'Could not remove the device.')),
  });
  return (
    <tr className="border-b border-line/60">
      <td className="py-2 pr-4 font-mono text-step--1 text-ink">{props.busId}</td>
      <td className="py-2 pr-4 text-ink">{props.imei}</td>
      <td className="py-2 pr-4 text-ink-muted">{props.deviceId ?? '—'}</td>
      <td className="py-2 pr-4"><Badge tone={props.status === 'ACTIVE' ? 'success' : 'neutral'} dot>{props.status}</Badge></td>
      <td className="py-2 text-right">
        <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={m.isPending} onClick={() => m.mutate()}>
          Remove
        </Button>
      </td>
    </tr>
  );
}
