import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, StatusBadge } from '@/components/ui';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, CardBody } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApiError } from '@/core/api/api-error';
import { SeatConfigEditor } from '../components/SeatConfigEditor';
import { layoutsApi } from '../api/layouts.api';
import { Permission } from '@/core/rbac/permissions';
import { formatDateTime, formatDuration } from '@/core/utils/date';
import { formatNumber } from '@/core/utils/format';
import {
  busesApi, countersApi, driversApi, hubsApi, routesApi, schedulesApi, stopsApi,
  type Bus, type BusRoute, type Driver, type Schedule, type Stop,
} from '../api/operations.api';

import type { CreateBusDto, CreateCounterDto, CreateDriverDto, CreateHubDto, CreateRouteDto, CreateScheduleDto, CreateStopDto } from '@/core/api/generated/dtos';
/* Each screen below is a description of a backend collection. The behaviour — loading,
 * empty, error, permissions, confirmation, toasts — comes from ResourcePage. */

const BUS_TYPES = [
  { value: 'SEATER', label: 'Seater' },
  { value: 'SLEEPER', label: 'Sleeper' },
  { value: 'SEMI_SLEEPER', label: 'Semi-sleeper' },
  { value: 'AC_SEATER', label: 'AC seater' },
  { value: 'AC_SLEEPER', label: 'AC sleeper' },
];

export function BusesPage() {
  // Seat configuration — reserved seats and neighbour pairs — had no UI at all. The API was
  // live, the permissions existed, and nothing in the product ever called it.
  const [seatBus, setSeatBus] = useState<Bus | null>(null);

  // Published layouts this operator can put on a bus. Assigning one REGENERATES the bus's
  // seat map, its ladies-reserved seats and its adjacency from the drawing — nobody types
  // any of that in again.
  const layouts = useQuery({ queryKey: ['layouts'], queryFn: () => layoutsApi.list() });
  const published = (layouts.data ?? []).filter((t) => t.status === 'PUBLISHED');

  return (
    <>
    {seatBus && (
      <div className="mb-5">
        <SeatConfigEditor bus={seatBus} onClose={() => setSeatBus(null)} />
      </div>
    )}
    <ResourcePage
      config={defineResource<Bus, CreateBusDto>({
        key: 'buses',
        title: 'Buses',
        singular: 'Bus',
        description: 'Your fleet, its seat layouts and what each vehicle is currently assigned to.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Buses' }],
        list: (params) => busesApi.list(params),
        create: busesApi.create,
        update: busesApi.update,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_BUS,
        emptyDescription: 'Add your first vehicle to start scheduling trips against it.',
        columns: [
          {
            id: 'registration',
            header: 'Registration',
            cell: (row) => <span className="tabular font-medium text-ink">{row.registrationNumber}</span>,
            sortValue: (row) => row.registrationNumber,
          },
          {
            id: 'type',
            header: 'Type',
            cell: (row) => <Badge>{row.busType?.replace(/_/g, ' ')}</Badge>,
            sortValue: (row) => row.busType,
          },
          {
            id: 'seats',
            header: 'Seats',
            align: 'right',
            cell: (row) => <span className="tabular">{formatNumber(row.totalSeats)}</span>,
            sortValue: (row) => row.totalSeats,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            sortValue: (row) => String(row.isActive),
          },
        ],
        fields: [
          { name: 'registrationNumber', label: 'Registration number', required: true, placeholder: 'RJ14 AB 1234' },
          { name: 'name', label: 'Name', required: true },
          { name: 'busType', label: 'Bus type', kind: 'select', options: [{ value: 'AC_SEATER', label: 'AC seater' }, { value: 'NON_AC_SEATER', label: 'NON AC seater' }, { value: 'AC_SLEEPER', label: 'AC sleeper' }, { value: 'NON_AC_SLEEPER', label: 'NON AC sleeper' }, { value: 'VOLVO', label: 'Volvo' }], required: true },
          { name: 'totalSeats', label: 'Total seats', kind: 'number', required: true, placeholder: '40' },
          { name: 'seatMap', label: 'Seat map', kind: 'csv', hint: 'Comma-separated.' },
        ],
        actions: [
          {
            label: 'Layout',
            permission: Permission.EDIT_BUS,
            tone: 'outline',
            // Assigning a layout rebuilds the bus's seat map from the drawing. It is the only
            // way a bus gets a real seat map — sleeper berths, decks, window seats and all.
            fields: [
              {
                name: 'templateId',
                label: 'Seat layout',
                kind: 'select' as const,
                required: true,
                options: published.map((t) => ({
                  value: t.id,
                  label: `${t.name} · v${t.version} · ${t.seatCount} seats`,
                })),
                hint: published.length
                  ? "The bus's seat map, ladies seats and adjacency are all rebuilt from it."
                  : 'No published layouts yet — draw one under Seat layouts first.',
              },
            ],
            run: (row, input) => layoutsApi.assign(row.id, { templateId: String(input.templateId) }),
          },
          {
            label: 'Seats',
            permission: Permission.EDIT_BUS,
            tone: 'outline',
            run: async (row) => {
              setSeatBus(row);
              return row;
            },
          },
          {
            label: 'Deactivate',
            permission: Permission.ACTIVATE_BUS,
            tone: 'outline',
            visible: (row) => row.isActive,
            confirm: (row) => `${row.registrationNumber} will stop appearing in searches and cannot be scheduled.`,
            run: (row) => busesApi.deactivate(row.id),
          },
          {
            label: 'Activate',
            permission: Permission.ACTIVATE_BUS,
            tone: 'outline',
            visible: (row) => !row.isActive,
            run: (row) => busesApi.activate(row.id),
          },
          {
            label: 'Delete',
            permission: Permission.DELETE_BUS,
            tone: 'danger',
            confirm: (row) => `${row.registrationNumber} will be removed. Trips already booked against it are unaffected.`,
            run: (row) => busesApi.remove(row.id),
          },
        ],
      })}
    />
    </>
  );
}

export function RoutesPage() {
  return (
    <ResourcePage
      config={defineResource<BusRoute, CreateRouteDto>({
        key: 'routes',
        title: 'Routes',
        singular: 'Route',
        description: 'The lanes you run, their stops and the time each one takes.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Routes' }],
        list: (params) => routesApi.list(params),
        create: routesApi.create,
        update: routesApi.update,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_ROUTE,
        columns: [
          { id: 'name', header: 'Route', cell: (row) => <span className="font-medium text-ink">{row.name}</span>, sortValue: (row) => row.name },
          {
            id: 'lane',
            header: 'From → To',
            cell: (row) => (
              <span className="text-ink-muted">
                {row.source} <span className="text-ink-faint">→</span> {row.destination}
              </span>
            ),
          },
          {
            id: 'distance',
            header: 'Distance',
            align: 'right',
            secondary: true,
            cell: (row) => <span className="tabular">{row.distanceKm ? `${row.distanceKm} km` : '—'}</span>,
            sortValue: (row) => row.distanceKm ?? 0,
          },
          {
            id: 'duration',
            header: 'Duration',
            align: 'right',
            secondary: true,
            cell: (row) => <span className="tabular">{formatDuration(row.durationMinutes)}</span>,
            sortValue: (row) => row.durationMinutes ?? 0,
          },
        ],
        fields: [
          { name: 'name', label: 'Route name', required: true, placeholder: 'Delhi – Jaipur Express' },
          { name: 'stops', label: 'Stops', kind: 'repeater', subFields: [{ name: 'stopId', label: 'Stop id', required: true }, { name: 'stopOrder', label: 'Stop order', kind: 'number', required: true }, { name: 'fareFromOrigin', label: 'Fare from origin', kind: 'number', required: true }, { name: 'arrivalOffsetMin', label: 'Arrival offset min', kind: 'number' }], required: true },
        ],
        actions: [
          {
            label: 'Delete',
            permission: Permission.DELETE_ROUTE,
            tone: 'danger',
            confirm: (row) => `${row.name} will be removed. Existing trips on it are unaffected.`,
            run: (row) => routesApi.remove(row.id),
          },
        ],
      })}
    />
  );
}

export function StopsPage() {
  return (
    <ResourcePage
      config={defineResource<Stop, CreateStopDto>({
        key: 'stops',
        title: 'Stops',
        singular: 'Stop',
        description: 'Boarding and dropping points that routes are built from.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Stops' }],
        list: (params) => stopsApi.list(params),
        rowId: (row) => row.id,
        createHref: '/operations/stops/new',
        createPermission: Permission.MANAGE_ROUTE_STOPS,
        columns: [
          { id: 'name', header: 'Stop', cell: (row) => <span className="font-medium text-ink">{row.name}</span>, sortValue: (row) => row.name },
          { id: 'city', header: 'City', cell: (row) => row.city ?? '—', sortValue: (row) => row.city ?? '' },
          {
            id: 'coords',
            header: 'Coordinates',
            secondary: true,
            cell: (row) =>
              row.latitude && row.longitude ? (
                <span className="tabular text-ink-muted">
                  {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                </span>
              ) : (
                '—'
              ),
          },
        ],
      })}
    />
  );
}

export function DriversPage() {
  return (
    <ResourcePage
      config={defineResource<Driver, CreateDriverDto>({
        key: 'drivers',
        title: 'Drivers',
        singular: 'Driver',
        description: 'Who is licensed to drive, and which vehicle they are on.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Drivers' }],
        list: (params) => driversApi.list(params),
        create: driversApi.create,
        update: driversApi.update,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_DRIVER,
        columns: [
          { id: 'name', header: 'Driver', cell: (row) => <span className="font-medium text-ink">{row.fullName}</span>, sortValue: (row) => row.fullName },
          { id: 'phone', header: 'Mobile', cell: (row) => <span className="tabular">{row.phone ?? '—'}</span> },
          {
            id: 'licence',
            header: 'Licence',
            secondary: true,
            cell: (row) => <span className="tabular text-ink-muted">{row.licenseNumber ?? '—'}</span>,
          },
          {
            id: 'assignment',
            header: 'Assigned',
            cell: (row) => (row.busId ? <Badge tone="primary">On a bus</Badge> : <Badge>Unassigned</Badge>),
          },
        ],
        fields: [
          { name: 'fullName', label: 'Full name', required: true },
          { name: 'phone', label: 'Mobile', required: true, placeholder: '9876543210' },
          { name: 'licenseNumber', label: 'Licence number', required: true },
          { name: 'licenseExpiry', label: 'License expiry', kind: 'date' },
        ],
        actions: [
          {
            label: 'Unassign',
            permission: Permission.ASSIGN_DRIVER,
            tone: 'outline',
            visible: (row) => Boolean(row.busId),
            run: (row) => driversApi.unassign(row.id),
          },
          {
            label: 'Delete',
            permission: Permission.EDIT_DRIVER,
            tone: 'danger',
            confirm: (row) => `${row.fullName} will be removed from the roster.`,
            run: (row) => driversApi.remove(row.id),
          },
        ],
      })}
    />
  );
}

export function SchedulesPage() {
  return (
    <ResourcePage
      config={defineResource<Schedule, CreateScheduleDto>({
        key: 'schedules',
        title: 'Schedules',
        singular: 'Schedule',
        description: 'Recurring departures. Generating a schedule creates the individual trips passengers can book.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Schedules' }],
        list: (params) => schedulesApi.list(params),
        create: schedulesApi.create,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_SCHEDULE,
        columns: [
          { id: 'id', header: 'Schedule', cell: (row) => <span className="tabular text-ink">{row.id.slice(0, 8)}</span> },
          { id: 'departure', header: 'Departs', cell: (row) => <span className="tabular">{row.departureTime}</span>, sortValue: (row) => row.departureTime },
          { id: 'recurrence', header: 'Repeats', secondary: true, cell: (row) => row.recurrence ?? '—' },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        fields: [
          { name: 'name', label: 'Name', required: true },
          { name: 'routeId', label: 'Route ID', required: true },
          { name: 'busId', label: 'Bus ID', required: true },
          { name: 'departureTime', label: 'Departure time', required: true, placeholder: '21:30' },
          { name: 'daysOfWeek', label: 'Days of week', kind: 'multiselect', valueType: 'number', options: [{ value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }], required: true },
          { name: 'recurrence', label: 'Recurrence' },
          { name: 'seasonStart', label: 'Season start' },
          { name: 'seasonEnd', label: 'Season end' },
          { name: 'fareMultiplier', label: 'Fare multiplier', kind: 'number' },
        ],
        actions: [
          {
            label: 'Activate',
            permission: Permission.ACTIVATE_SCHEDULE,
            visible: (row) => row.status !== 'ACTIVE',
            run: (row) => schedulesApi.activate(row.id),
          },
          {
            label: 'Suspend',
            permission: Permission.ACTIVATE_SCHEDULE,
            tone: 'outline',
            visible: (row) => row.status === 'ACTIVE',
            confirm: () => 'New trips will stop being generated. Trips already booked are unaffected.',
            run: (row) => schedulesApi.suspend(row.id),
          },
          {
            label: 'Generate trips',
            permission: Permission.CREATE_TRIP,
            tone: 'primary',
            visible: (row) => row.status === 'ACTIVE',
            // A date range is mandatory. This used to post `{}` and always failed.
            fields: [
              { name: 'fromDate', label: 'From', kind: 'date', required: true },
              { name: 'toDate', label: 'To', kind: 'date', required: true },
            ],
            run: (row, input) =>
              schedulesApi.generate(row.id, { fromDate: String(input.fromDate), toDate: String(input.toDate) }),
          },
        ],
      })}
    />
  );
}

interface HubRow extends Record<string, unknown> {
  id: string;
  name?: string;
  city?: string;
  status?: string;
}

export function HubsPage() {
  return (
    <ResourcePage
      config={defineResource<HubRow, CreateHubDto>({
        key: 'hubs',
        title: 'Hubs',
        singular: 'Hub',
        description: 'Depots and interchanges, and the routes that pass through them.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Hubs' }],
        list: () => hubsApi.list() as Promise<HubRow[]>,
        create: hubsApi.create,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.MANAGE_HUB,
        columns: [
          { id: 'name', header: 'Hub', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? '—')}</span> },
          { id: 'city', header: 'City', cell: (row) => String(row.city ?? '—') },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'ACTIVE')} /> },
        ],
        fields: [
          { name: 'name', label: 'Hub name', required: true },
          { name: 'stopId', label: 'Stop id', required: true },
          { name: 'city', label: 'City' },
        ],
      })}
    />
  );
}

interface CounterRow extends Record<string, unknown> {
  id: string;
  name?: string;
  location?: string;
  status?: string;
}

export function CountersPage() {
  return (
    <ResourcePage
      config={defineResource<CounterRow, CreateCounterDto>({
        key: 'counters',
        title: 'Counters',
        singular: 'Counter',
        description: 'Physical ticket counters and the agents who sell from them.',
        breadcrumbs: [{ label: 'Operations' }, { label: 'Counters' }],
        list: () => countersApi.list() as Promise<CounterRow[]>,
        create: countersApi.create,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.MANAGE_COUNTER,
        columns: [
          { id: 'name', header: 'Counter', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? '—')}</span> },
          { id: 'location', header: 'Location', cell: (row) => String(row.location ?? '—') },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'ACTIVE')} /> },
        ],
        fields: [
          { name: 'name', label: 'Counter name', required: true },
          { name: 'location', label: 'Location' },
        ],
      })}
    />
  );
}


const opFieldBase =
  'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-step-0 text-ink placeholder:text-ink-muted/50 outline-none transition-all focus:ring-4 focus:ring-brand/15';
function OpField(props: { label: string; value: string; onChange: (v: string) => void; type?: string; error?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-step--1 font-medium text-ink">{props.label}</label>
      <input
        className={`${opFieldBase} ${props.error ? 'border-red-400 focus:ring-red-100' : 'border-line hover:border-ink-muted/40 focus:border-brand'}`}
        type={props.type ?? 'text'} value={props.value} placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error && <p className="mt-1 text-step--1 text-red-500">{props.error}</p>}
    </div>
  );
}

/** Create a stop — a full page, not a modal. */
export function NewStopPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', city: '', state: '', code: '', latitude: '', longitude: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors: Record<string, string | undefined> = {
    name: f.name.trim().length < 2 ? 'Stop name is required.' : undefined,
    city: f.city.trim().length < 2 ? 'City is required.' : undefined,
    code: !f.code.trim() ? 'Code is required.' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => stopsApi.create({
      name: f.name.trim(), city: f.city.trim(), state: f.state.trim() || undefined,
      code: f.code.trim().toUpperCase(),
      latitude: f.latitude ? Number(f.latitude) : undefined,
      longitude: f.longitude ? Number(f.longitude) : undefined,
    }),
    onSuccess: () => { toast.success('Stop created.'); qc.invalidateQueries({ queryKey: ['stops'] }); nav('/operations/stops'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create the stop.'),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="New stop" description="A boarding or dropping point that routes are built from." />
      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <OpField label="Stop name *" value={f.name} onChange={set('name')} placeholder="Kashmere Gate ISBT" error={submitted ? errors.name : undefined} />
            <OpField label="Code *" value={f.code} onChange={set('code')} placeholder="KG-ISBT" error={submitted ? errors.code : undefined} />
            <OpField label="City *" value={f.city} onChange={set('city')} placeholder="Delhi" error={submitted ? errors.city : undefined} />
            <OpField label="State" value={f.state} onChange={set('state')} placeholder="Delhi" />
            <OpField label="Latitude" type="number" value={f.latitude} onChange={set('latitude')} placeholder="28.6675" />
            <OpField label="Longitude" type="number" value={f.longitude} onChange={set('longitude')} placeholder="77.2281" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" isLoading={create.isPending} disabled={create.isPending} onClick={() => { setSubmitted(true); if (!hasErrors) create.mutate(); }}>Create stop</Button>
            <Link to="/operations/stops"><Button variant="ghost">Cancel</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
