import { Badge, StatusBadge } from '@/components/ui';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Permission } from '@/core/rbac/permissions';
import { formatRelative } from '@/core/utils/date';
import { humanise } from '@/core/utils/format';
import { supportApi, type SupportTicket } from '../api/support.api';
import { notificationsApi } from '@/features/platform/api/platform.api';

import type { BlacklistDto, CreateComplaintDto, CreateTicketDto, LostFoundDto } from '@/core/api/generated/dtos';
type Row = Record<string, unknown> & { id: string };

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'neutral',
  LOW: 'neutral',
};

export function TicketsPage() {
  return (
    <ResourcePage
      config={defineResource<SupportTicket, CreateTicketDto>({
        key: 'tickets',
        title: 'Tickets',
        singular: 'Ticket',
        description: 'Everything a passenger or an operator has asked you to fix.',
        breadcrumbs: [{ label: 'Support' }, { label: 'Tickets' }],
        list: (params) => supportApi.listTickets(params),
        create: supportApi.createTicket,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_SUPPORT_TICKET,
        emptyDescription: 'Nothing is open. When a passenger raises an issue it lands here.',
        filters: [
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'OPEN', label: 'Open' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
            ],
          },
        ],
        columns: [
          {
            id: 'subject',
            header: 'Subject',
            cell: (row) => (
              <div>
                <p className="font-medium text-ink">{row.subject}</p>
                {row.category && <p className="text-step--1 text-ink-muted">{humanise(row.category)}</p>}
              </div>
            ),
            sortValue: (row) => row.subject,
          },
          {
            id: 'priority',
            header: 'Priority',
            cell: (row) =>
              row.priority ? <Badge tone={PRIORITY_TONE[row.priority] ?? 'neutral'}>{humanise(row.priority)}</Badge> : '—',
            sortValue: (row) => row.priority ?? '',
          },
          { id: 'raised', header: 'Raised', secondary: true, cell: (row) => formatRelative(row.createdAt), sortValue: (row) => row.createdAt },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        fields: [
          { name: 'subject', label: 'Subject', required: true },
          { name: 'description', label: 'What is the problem?' },
        ],
        actions: [
          {
            label: 'Escalate',
            permission: Permission.ASSIGN_SUPPORT_TICKET,
            tone: 'outline',
            visible: (row) => row.status !== 'CLOSED',
            run: (row) => supportApi.escalate(row.id),
          },
          {
            label: 'Resolve',
            permission: Permission.CLOSE_SUPPORT_TICKET,
            tone: 'primary',
            visible: (row) => row.status !== 'RESOLVED' && row.status !== 'CLOSED',
            run: (row) => supportApi.resolve(row.id),
          },
          {
            label: 'Close',
            permission: Permission.CLOSE_SUPPORT_TICKET,
            tone: 'ghost',
            visible: (row) => row.status === 'RESOLVED',
            run: (row) => supportApi.close(row.id),
          },
        ],
      })}
    />
  );
}

export function ComplaintsPage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateComplaintDto>({
        key: 'complaints',
        title: 'Complaints',
        singular: 'Complaint',
        description: 'Formal complaints against a trip, a driver or a service.',
        breadcrumbs: [{ label: 'Support' }, { label: 'Complaints' }],
        list: (params) => supportApi.listComplaints(params) as Promise<Row[]>,
        create: supportApi.createComplaint,
        rowId: (row) => row.id,
        columns: [
          { id: 'subject', header: 'Complaint', cell: (row) => <span className="font-medium text-ink">{String(row.subject ?? row.category ?? '—')}</span> },
          { id: 'pnr', header: 'PNR', secondary: true, cell: (row) => <span className="tabular">{String(row.pnr ?? '—')}</span> },
          { id: 'raised', header: 'Raised', cell: (row) => formatRelative(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'OPEN')} /> },
        ],
        fields: [
          { name: 'subject', label: 'Subject', required: true },
          { name: 'customerUserId', label: 'Customer user id' },
        ],
        actions: [
          { label: 'Resolve', permission: Permission.RESOLVE_COMPLAINT, tone: 'primary', visible: (row) => String(row.status) !== 'RESOLVED', run: (row) => supportApi.resolveComplaint(row.id) },
          { label: 'Reopen', permission: Permission.RESOLVE_COMPLAINT, tone: 'outline', visible: (row) => String(row.status) === 'RESOLVED', run: (row) => supportApi.reopenComplaint(row.id) },
        ],
      })}
    />
  );
}

export function LostFoundPage() {
  return (
    <ResourcePage
      config={defineResource<Row, LostFoundDto>({
        key: 'lost-found',
        title: 'Lost & found',
        singular: 'Item',
        description: 'What was left on a bus, and whether it found its way home.',
        breadcrumbs: [{ label: 'Support' }, { label: 'Lost & found' }],
        list: (params) => supportApi.listLostFound(params) as Promise<Row[]>,
        create: supportApi.createLostFound,
        rowId: (row) => row.id,
        createPermission: Permission.MANAGE_LOST_FOUND,
        columns: [
          { id: 'item', header: 'Item', cell: (row) => <span className="font-medium text-ink">{String(row.itemName ?? row.description ?? '—')}</span> },
          { id: 'trip', header: 'Trip', secondary: true, cell: (row) => <span className="tabular text-ink-muted">{String(row.tripId ?? '—').slice(0, 8)}</span> },
          { id: 'found', header: 'Reported', cell: (row) => formatRelative(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'OPEN')} /> },
        ],
        fields: [
          { name: 'itemDescription', label: 'Item description', required: true },
          { name: 'tripId', label: 'Trip ID' },
        ],
        actions: [
          { label: 'Close', permission: Permission.MANAGE_LOST_FOUND, tone: 'outline', visible: (row) => String(row.status) !== 'CLOSED', confirm: () => 'Mark this item as returned or disposed of.', run: (row) => supportApi.closeLostFound(row.id) },
        ],
      })}
    />
  );
}

export function BlacklistPage() {
  return (
    <ResourcePage
      config={defineResource<Row, BlacklistDto>({
        key: 'blacklist',
        title: 'Blacklist',
        singular: 'Entry',
        description: 'Passengers barred from booking. Use this sparingly and record why.',
        breadcrumbs: [{ label: 'Support' }, { label: 'Blacklist' }],
        list: () => supportApi.listBlacklist() as Promise<Row[]>,
        create: supportApi.addToBlacklist,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.BLACKLIST_PASSENGER,
        emptyDescription: 'No one is barred.',
        columns: [
          { id: 'who', header: 'Passenger', cell: (row) => <span className="font-medium text-ink">{String(row.passengerName ?? row.phone ?? row.email ?? '—')}</span> },
          { id: 'reason', header: 'Reason', cell: (row) => String(row.reason ?? '—') },
          { id: 'when', header: 'Added', secondary: true, cell: (row) => formatRelative(row.createdAt as string) },
        ],
        fields: [
          { name: 'customerUserId', label: 'Customer user id', required: true },
          { name: 'blacklisted', label: 'Blacklisted', kind: 'switch', required: true },
          { name: 'reason', label: 'Why are they being barred?' },
        ],
      })}
    />
  );
}

export function NotificationsPage() {
  return (
    <ResourcePage
      config={defineResource<Row>({
        key: 'notifications',
        title: 'Notifications',
        singular: 'Notification',
        description: 'Messages sent to passengers and staff, and whether they landed.',
        breadcrumbs: [{ label: 'Support' }, { label: 'Notifications' }],
        list: (params) => notificationsApi.log(params) as Promise<Row[]>,
        rowId: (row) => row.id,
        searchable: false,
        columns: [
          { id: 'channel', header: 'Channel', cell: (row) => <Badge>{humanise(String(row.channel ?? 'EMAIL'))}</Badge> },
          { id: 'to', header: 'Recipient', cell: (row) => <span className="tabular text-ink-muted">{String(row.recipient ?? row.to ?? '—')}</span> },
          { id: 'subject', header: 'Message', secondary: true, cell: (row) => String(row.subject ?? row.template ?? '—') },
          { id: 'when', header: 'Sent', cell: (row) => formatRelative(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'SENT')} /> },
        ],
      })}
    />
  );
}
