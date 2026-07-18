import { Badge, StatusBadge } from '@/components/ui';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Permission } from '@/core/rbac/permissions';
import { formatDate, formatRelative } from '@/core/utils/date';
import { formatMoney, formatNumber, humanise } from '@/core/utils/format';
import { crewApi, disruptionApi, driverComplianceApi, forecastingApi, fuelApi, maintenanceWorkApi } from '../api/fleet.api';

import type { CreateEmployeeDto, CreateForecastDto, CreateWorkOrderDto, DeclareDisruptionDto, FuelTxnDto } from '@/core/api/generated/dtos';
type Row = Record<string, unknown> & { id: string };

export function WorkOrdersPage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateWorkOrderDto>({
        key: 'work-orders',
        title: 'Maintenance',
        singular: 'Work order',
        description: 'What is off the road, why, and when it comes back.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Maintenance' }],
        list: (params) => maintenanceWorkApi.listWorkOrders(params) as Promise<Row[]>,
        create: maintenanceWorkApi.createWorkOrder,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_WORK_ORDER,
        columns: [
          { id: 'bus', header: 'Vehicle', cell: (row) => <span className="tabular font-medium text-ink">{String(row.busRegistration ?? row.busId ?? '—')}</span> },
          { id: 'type', header: 'Work', cell: (row) => <Badge>{humanise(String(row.type ?? 'REPAIR'))}</Badge> },
          { id: 'cost', header: 'Cost', align: 'right', secondary: true, cell: (row) => <span className="tabular">{row.cost ? formatMoney(Number(row.cost)) : '—'}</span> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'OPEN')} /> },
        ],
        fields: [
          { name: 'busId', label: 'Bus ID', required: true },
          { name: 'title', label: 'Title', required: true },
          { name: 'description', label: 'What needs doing' },
        ],
        actions: [
          { label: 'Start', tone: 'primary', visible: (row) => String(row.status) === 'OPEN', run: (row) => maintenanceWorkApi.start(row.id) },
          { label: 'Close', permission: Permission.APPROVE_WORK_ORDER, tone: 'outline', visible: (row) => String(row.status) === 'IN_PROGRESS', run: (row) => maintenanceWorkApi.close(row.id) },
          { label: 'Cancel', tone: 'danger', confirm: () => 'The work order will be cancelled.', visible: (row) => String(row.status) !== 'CLOSED', run: (row) => maintenanceWorkApi.cancel(row.id) },
        ],
      })}
    />
  );
}

export function FuelPage() {
  return (
    <ResourcePage
      config={defineResource<Row, FuelTxnDto>({
        key: 'fuel',
        title: 'Fuel',
        singular: 'Transaction',
        description: 'Every fill, what it cost, and which transactions still need approving.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Fuel' }],
        list: (params) => fuelApi.listTransactions(params) as Promise<Row[]>,
        create: fuelApi.createTransaction,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_FUEL_TXN,
        columns: [
          { id: 'bus', header: 'Vehicle', cell: (row) => <span className="tabular font-medium text-ink">{String(row.busRegistration ?? row.busId ?? '—')}</span> },
          { id: 'litres', header: 'Litres', align: 'right', cell: (row) => <span className="tabular">{formatNumber(Number(row.litres ?? 0))}</span> },
          { id: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="tabular font-medium">{formatMoney(Number(row.amount ?? 0))}</span> },
          { id: 'when', header: 'Filled', secondary: true, cell: (row) => formatDate(row.filledAt as string ?? row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'PENDING')} /> },
        ],
        fields: [
          { name: 'busId', label: 'Bus ID', required: true },
          { name: 'type', label: 'Type', required: true },
          { name: 'litres', label: 'Litres', kind: 'number', required: true },
          { name: 'pricePerLitre', label: 'Price per litre', kind: 'number' },
          { name: 'odometerKm', label: 'Odometer km', kind: 'number' },
          { name: 'note', label: 'Note' },
        ],
        actions: [
          {
            label: 'Approve',
            permission: Permission.APPROVE_FUEL_TXN,
            tone: 'primary',
            visible: (row) => String(row.status ?? 'PENDING') === 'PENDING',
            run: (row) => fuelApi.approveTransaction(row.id),
          },
        ],
      })}
    />
  );
}

export function DriverCompliancePage() {
  return (
    <ResourcePage
      config={defineResource<Row>({
        key: 'driver-compliance',
        title: 'Driver compliance',
        singular: 'Document',
        description: 'Licences and certificates that are about to expire. Anyone listed here should not be rostered.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Driver compliance' }],
        list: () => driverComplianceApi.expiring() as Promise<Row[]>,
        rowId: (row) => row.id,
        searchable: false,
        emptyDescription: 'Every driver document is current. Nothing expires soon.',
        columns: [
          { id: 'driver', header: 'Driver', cell: (row) => <span className="font-medium text-ink">{String(row.driverName ?? row.driverId ?? '—')}</span> },
          { id: 'doc', header: 'Document', cell: (row) => <Badge>{humanise(String(row.documentType ?? ''))}</Badge> },
          { id: 'expires', header: 'Expires', cell: (row) => (
            <span className="text-warning">{formatRelative(row.expiryDate as string)}</span>
          ) },
          { id: 'date', header: 'Expiry date', secondary: true, cell: (row) => formatDate(row.expiryDate as string) },
        ],
      })}
    />
  );
}

export function CrewPage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateEmployeeDto>({
        key: 'crew',
        title: 'Crew & HR',
        singular: 'Employee',
        description: 'Everyone on the payroll, their shifts and their leave.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Crew' }],
        list: (params) => crewApi.listEmployees(params) as Promise<Row[]>,
        create: crewApi.createEmployee,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_EMPLOYEE,
        columns: [
          { id: 'name', header: 'Employee', cell: (row) => <span className="font-medium text-ink">{String(row.fullName ?? row.name ?? '—')}</span> },
          { id: 'role', header: 'Role', cell: (row) => <Badge>{humanise(String(row.designation ?? row.role ?? ''))}</Badge> },
          { id: 'phone', header: 'Mobile', secondary: true, cell: (row) => <span className="tabular">{String(row.phone ?? '—')}</span> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'ACTIVE')} /> },
        ],
        fields: [
          { name: 'fullName', label: 'Full name', required: true },
          { name: 'designation', label: 'Designation', required: true, placeholder: 'Conductor' },
          { name: 'phone', label: 'Mobile' },
        ],
      })}
    />
  );
}

export function DisruptionPage() {
  return (
    <ResourcePage
      config={defineResource<Row, DeclareDisruptionDto>({
        key: 'disruption',
        title: 'Disruption',
        singular: 'Incident',
        description: 'Breakdowns, diversions and delays — and what was done about each.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Disruption' }],
        list: (params) => disruptionApi.list(params) as Promise<Row[]>,
        create: disruptionApi.create,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_DISRUPTION,
        emptyDescription: 'Nothing is disrupted. Trips are running as scheduled.',
        columns: [
          { id: 'type', header: 'Incident', cell: (row) => <span className="font-medium text-ink">{humanise(String(row.type ?? ''))}</span> },
          { id: 'trip', header: 'Trip', secondary: true, cell: (row) => <span className="tabular text-ink-muted">{String(row.tripId ?? '—').slice(0, 8)}</span> },
          { id: 'raised', header: 'Raised', cell: (row) => formatRelative(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'OPEN')} /> },
        ],
        fields: [
          { name: 'type', label: 'Type', required: true },
          { name: 'severity', label: 'Severity', required: true },
          { name: 'description', label: 'What happened', required: true },
          { name: 'tripId', label: 'Trip ID' },
        ],
        actions: [
          {
            label: 'Deploy backup',
            permission: Permission.DEPLOY_BACKUP,
            tone: 'primary',
            visible: (row) => String(row.status) === 'OPEN',
            // The server needs to know WHICH bus. This used to post `{}` and always failed.
            fields: [{ name: 'backupBusId', label: 'Backup bus', kind: 'text', required: true, hint: 'Id of the bus taking over this trip.' }],
            run: (row, input) => disruptionApi.deployBackup(row.id, { backupBusId: String(input.backupBusId) }),
          },
          { label: 'Resolve', permission: Permission.CLOSE_DISRUPTION, tone: 'outline', visible: (row) => String(row.status) !== 'CLOSED', run: (row) => disruptionApi.resolve(row.id) },
          { label: 'Close', permission: Permission.CLOSE_DISRUPTION, tone: 'ghost', visible: (row) => String(row.status) === 'RESOLVED', run: (row) => disruptionApi.close(row.id) },
        ],
      })}
    />
  );
}

export function ForecastingPage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateForecastDto>({
        key: 'forecasting',
        title: 'Forecasting',
        singular: 'Forecast',
        description: 'Projected demand by route, so you can put capacity where it will sell.',
        breadcrumbs: [{ label: 'Fleet care' }, { label: 'Forecasting' }],
        list: (params) => forecastingApi.list(params) as Promise<Row[]>,
        create: forecastingApi.generate,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.GENERATE_FORECAST,
        columns: [
          { id: 'route', header: 'Route', cell: (row) => <span className="font-medium text-ink">{String(row.routeName ?? row.routeId ?? '—')}</span> },
          { id: 'period', header: 'Period', cell: (row) => formatDate(row.forecastDate as string) },
          { id: 'demand', header: 'Projected seats', align: 'right', cell: (row) => <span className="tabular font-medium">{formatNumber(Number(row.projectedDemand ?? 0))}</span> },
          { id: 'confidence', header: 'Confidence', align: 'right', secondary: true, cell: (row) => <span className="tabular">{row.confidence ? `${Math.round(Number(row.confidence) * 100)}%` : '—'}</span> },
        ],
        fields: [
          { name: 'routeId', label: 'Route ID', required: true },
          { name: 'forecastDate', label: 'Forecast date', kind: 'date', required: true },
          { name: 'predictedOccupancy', label: 'Predicted occupancy', kind: 'number', required: true },
        ],
      })}
    />
  );
}
