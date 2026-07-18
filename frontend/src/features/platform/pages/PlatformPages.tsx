import { Badge, StatusBadge } from '@/components/ui';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Permission } from '@/core/rbac/permissions';
import { formatDate, formatDateTime, formatRelative } from '@/core/utils/date';
import { formatMoney, formatPercent, humanise } from '@/core/utils/format';
import {
  apiManagementApi, auditApi, complianceApi, corporateApi, operatorsApi,
  reliabilityApi, saasBillingApi,
  type AuditEntry, type Operator, type SaasInvoice,
} from '../api/platform.api';

import type { CreateCorporateDto, CreateDsrDto, GenerateInvoiceDto, RegisterPartnerDto } from '@/core/api/generated/dtos';
type Row = Record<string, unknown> & { id: string };

export function OperatorsPage() {
  return (
    <ResourcePage
      config={defineResource<Operator>({
        key: 'operators',
        title: 'Operators',
        singular: 'Operator',
        description: 'Commercial terms and standing for each operator on the platform.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Operators' }],
        list: (params) => operatorsApi.list(params),
        rowId: (row) => row.id,
        columns: [
          {
            id: 'name',
            header: 'Operator',
            cell: (row) => (
              <div>
                <p className="font-medium text-ink">{row.brandName}</p>
                <p className="text-step--1 text-ink-muted">{row.legalName}</p>
              </div>
            ),
            sortValue: (row) => row.brandName,
          },
          { id: 'email', header: 'Contact', secondary: true, cell: (row) => row.email },
          {
            id: 'commission',
            header: 'Commission',
            align: 'right',
            cell: (row) => <span className="tabular">{formatPercent(row.commissionRate ?? 0, 2)}</span>,
            sortValue: (row) => row.commissionRate ?? 0,
          },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        actions: [
          {
            label: 'Suspend',
            permission: Permission.SUSPEND_OPERATOR,
            tone: 'danger',
            visible: (row) => row.status === 'ACTIVE',
            confirm: (row) => `${row.brandName} will stop selling immediately.`,
            run: (row) => operatorsApi.suspend(row.id),
          },
          {
            label: 'Activate',
            permission: Permission.ACTIVATE_OPERATOR,
            visible: (row) => row.status !== 'ACTIVE',
            run: (row) => operatorsApi.activate(row.id),
          },
        ],
      })}
    />
  );
}

interface OperatorLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  totalBuses: number;
  city?: string;
  status: string;
  kyc?: { gstin?: string; pan?: string };
  createdAt?: string;
}

/**
 * Operator applications pipeline (SuperAdmin).
 *
 * Every "Become an Operator" application lands here and moves through the stages
 * NEW -> CONTACTED -> UNDER_VERIFICATION -> APPROVED / REJECTED, each with its own action.
 * Approving creates the operator account and emails the credentials; rejecting emails the reason.
 */
export function OperatorLeadsPage() {
  return (
    <ResourcePage
      config={defineResource<OperatorLead>({
        key: 'operator-leads',
        title: 'Operator applications',
        singular: 'Application',
        description: 'Applied \u2192 contacted \u2192 verifying \u2192 approved / rejected. Approval emails the login credentials.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Applications' }],
        list: () => operatorsApi.leads() as unknown as Promise<OperatorLead[]>,
        rowId: (row) => row.id,
        columns: [
          {
            id: 'company',
            header: 'Company',
            cell: (row) => (
              <div>
                <p className="font-medium text-ink">{row.companyName}</p>
                <p className="text-step--1 text-ink-muted">{row.contactName}</p>
              </div>
            ),
            sortValue: (row) => row.companyName,
          },
          {
            id: 'contact',
            header: 'Contact',
            secondary: true,
            cell: (row) => (
              <div>
                <p>{row.email}</p>
                <p className="text-step--1 text-ink-muted">{row.mobile}</p>
              </div>
            ),
          },
          { id: 'gstin', header: 'GSTIN', secondary: true, cell: (row) => row.kyc?.gstin ?? '\u2014' },
          { id: 'buses', header: 'Buses', align: 'right', cell: (row) => row.totalBuses, sortValue: (row) => row.totalBuses },
          { id: 'status', header: 'Stage', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        actions: [
          {
            label: 'Mark contacted',
            permission: Permission.EDIT_OPERATOR,
            visible: (row) => row.status === 'NEW',
            run: (row) => operatorsApi.markContacted(row.id),
          },
          {
            label: 'Start verification',
            permission: Permission.EDIT_OPERATOR,
            visible: (row) => row.status === 'NEW' || row.status === 'CONTACTED',
            run: (row) => operatorsApi.startVerification(row.id),
          },
          {
            label: 'Approve',
            permission: Permission.CREATE_OPERATOR,
            tone: 'primary',
            visible: (row) => row.status !== 'APPROVED' && row.status !== 'REJECTED',
            confirm: (row) => `Approve ${row.companyName}? An operator account will be created and the login credentials emailed to ${row.email}.`,
            run: (row) => operatorsApi.approveLead(row.id),
          },
          {
            label: 'Reject',
            permission: Permission.CREATE_OPERATOR,
            tone: 'danger',
            visible: (row) => row.status !== 'APPROVED' && row.status !== 'REJECTED',
            run: (row) => {
              const reason = window.prompt('Reason for rejection (emailed to the applicant):') || 'Application rejected after review.';
              return operatorsApi.rejectLead(row.id, { reason });
            },
          },
        ],
      })}
    />
  );
}

export function SaasBillingPage() {
  return (
    <ResourcePage
      config={defineResource<SaasInvoice, GenerateInvoiceDto>({
        key: 'saas-invoices',
        title: 'SaaS billing',
        singular: 'Invoice',
        description: 'What operators owe the platform, and what they have paid.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'SaaS billing' }],
        list: (params) => saasBillingApi.listInvoices(params),
        create: saasBillingApi.createInvoice,
        rowId: (row) => row.id,
        createPermission: Permission.CREATE_SAAS_INVOICE,
        filters: [
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'PAID', label: 'Paid' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'VOID', label: 'Void' },
            ],
          },
        ],
        columns: [
          { id: 'number', header: 'Invoice', cell: (row) => <span className="tabular font-medium text-ink">{row.invoiceNumber}</span>, sortValue: (row) => row.invoiceNumber },
          { id: 'operator', header: 'Operator', secondary: true, cell: (row) => <span className="tabular text-ink-muted">{row.operatorId.slice(0, 8)}</span> },
          { id: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="tabular font-medium">{formatMoney(row.amount)}</span>, sortValue: (row) => row.amount },
          { id: 'due', header: 'Due', cell: (row) => formatDate(row.dueDate), sortValue: (row) => row.dueDate },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        fields: [
          { name: 'operatorId', label: 'Operator ID', required: true },
          { name: 'customerGstin', label: 'Customer gstin' },
          { name: 'customerStateCode', label: 'Customer state code' },
          { name: 'gstRate', label: 'Gst rate', kind: 'number' },
          { name: 'items', label: 'Items', kind: 'repeater', subFields: [{ name: 'description', label: 'Description', required: true }, { name: 'quantity', label: 'Quantity', kind: 'number', required: true }, { name: 'unitPrice', label: 'Unit price', kind: 'number', required: true }], required: true },
          { name: 'dueDays', label: 'Due days', kind: 'number' },
        ],
        actions: [
          {
            label: 'Void',
            permission: Permission.VOID_SAAS_INVOICE,
            tone: 'danger',
            visible: (row) => row.status !== 'PAID' && row.status !== 'VOID',
            confirm: (row) => `Invoice ${row.invoiceNumber} will be voided. This cannot be undone; issue a credit note instead if it was already sent.`,
            run: (row) => saasBillingApi.voidInvoice(row.id),
          },
        ],
      })}
    />
  );
}

export function AuditPage() {
  return (
    <ResourcePage
      config={defineResource<AuditEntry>({
        key: 'audit',
        title: 'Audit log',
        singular: 'Entry',
        description: 'Every privileged action taken on the platform, and who took it.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Audit log' }],
        list: (params) => auditApi.list(params),
        rowId: (row) => row.id,
        emptyDescription: 'Nothing has been recorded for this filter.',
        columns: [
          {
            id: 'action',
            header: 'Action',
            cell: (row) => (
              <div>
                <p className="font-medium text-ink">{humanise(row.action)}</p>
                <p className="tabular text-step--1 text-ink-muted">
                  {row.method} {row.path}
                </p>
              </div>
            ),
          },
          { id: 'actor', header: 'Actor', secondary: true, cell: (row) => (row.role ? <Badge>{humanise(row.role)}</Badge> : '—') },
          {
            id: 'result',
            header: 'Result',
            align: 'center',
            cell: (row) => (
              <span className={`tabular ${row.statusCode >= 400 ? 'text-danger' : 'text-success'}`}>{row.statusCode}</span>
            ),
            sortValue: (row) => row.statusCode,
          },
          { id: 'when', header: 'When', cell: (row) => formatRelative(row.createdAt), sortValue: (row) => row.createdAt },
        ],
      })}
    />
  );
}


export function ApiPartnersPage() {
  return (
    <ResourcePage
      config={defineResource<Row, RegisterPartnerDto>({
        key: 'api-partners',
        title: 'API partners',
        singular: 'Partner',
        description: 'Third parties calling the Yoo Bus API, their keys and their webhooks.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'API partners' }],
        list: () => apiManagementApi.listPartners() as Promise<Row[]>,
        create: apiManagementApi.createPartner,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.CREATE_API_PARTNER,
        columns: [
          { id: 'name', header: 'Partner', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? '—')}</span> },
          { id: 'email', header: 'Contact', secondary: true, cell: (row) => String(row.email ?? '—') },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'PENDING')} /> },
        ],
        fields: [
          { name: 'name', label: 'Partner name', required: true },
          { name: 'email', label: 'Contact email', kind: 'email', required: true },
          { name: 'callbackUrl', label: 'Callback url' },
          { name: 'rateLimitPerMinute', label: 'Rate limit per minute', kind: 'number' },
          { name: 'scopes', label: 'Scopes', kind: 'csv', hint: 'Comma-separated.' },
        ],
        actions: [
          { label: 'Approve', permission: Permission.APPROVE_API_PARTNER, tone: 'primary', visible: (row) => row.status === 'PENDING', run: (row) => apiManagementApi.approvePartner(row.id) },
          { label: 'Issue key', permission: Permission.GENERATE_API_KEY, tone: 'outline', run: (row) => apiManagementApi.createKey(row.id) },
          {
            label: 'Suspend',
            permission: Permission.APPROVE_API_PARTNER,
            tone: 'danger',
            visible: (row) => row.status === 'ACTIVE' || row.status === 'APPROVED',
            confirm: () => 'Their keys stop working immediately.',
            run: (row) => apiManagementApi.suspendPartner(row.id),
          },
        ],
      })}
    />
  );
}

export function CompliancePage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateDsrDto>({
        key: 'compliance',
        title: 'Compliance',
        singular: 'Request',
        description: 'Data access and deletion requests, and the clock you are working against.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Compliance' }],
        list: () => complianceApi.listRequests() as Promise<Row[]>,
        create: complianceApi.createRequest,
        rowId: (row) => row.id,
        searchable: false,
        createPermission: Permission.PROCESS_DATA_ACCESS_REQUEST,
        columns: [
          { id: 'type', header: 'Request', cell: (row) => <span className="font-medium text-ink">{humanise(String(row.type ?? ''))}</span> },
          { id: 'subject', header: 'Data subject', secondary: true, cell: (row) => String(row.subjectEmail ?? row.userId ?? '—') },
          { id: 'raised', header: 'Raised', cell: (row) => formatRelative(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'PENDING')} /> },
        ],
        fields: [
          { name: 'subjectEmail', label: 'Data subject email', kind: 'email', required: true },
          { name: 'type', label: 'Type', required: true },
          { name: 'note', label: 'Note' },
        ],
      })}
    />
  );
}

export function ReliabilityPage() {
  return (
    <ResourcePage
      config={defineResource<Row>({
        key: 'reliability-jobs',
        title: 'Background jobs',
        singular: 'Job',
        description: 'Scheduled work, what failed, and what can be retried.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Reliability' }],
        list: () => reliabilityApi.listJobs() as Promise<Row[]>,
        rowId: (row) => row.id,
        searchable: false,
        columns: [
          { id: 'name', header: 'Job', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? row.type ?? '—')}</span> },
          { id: 'run', header: 'Last run', secondary: true, cell: (row) => formatDateTime(row.lastRunAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'PENDING')} /> },
        ],
        actions: [
          {
            label: 'Retry',
            permission: Permission.MANAGE_BACKGROUND_JOBS,
            tone: 'outline',
            visible: (row) => String(row.status) === 'FAILED',
            run: (row) => reliabilityApi.retryJob(row.id),
          },
        ],
      })}
    />
  );
}

export function CorporatePage() {
  return (
    <ResourcePage
      config={defineResource<Row, CreateCorporateDto>({
        key: 'corporate',
        title: 'Corporate accounts',
        singular: 'Account',
        description: 'Companies that book on credit, and the employees who can travel on their account.',
        breadcrumbs: [{ label: 'Platform' }, { label: 'Corporate' }],
        list: () => corporateApi.list() as Promise<Row[]>,
        create: corporateApi.create,
        rowId: (row) => row.id,
        searchable: false,
        columns: [
          { id: 'name', header: 'Company', cell: (row) => <span className="font-medium text-ink">{String(row.name ?? '—')}</span> },
          { id: 'gstin', header: 'GSTIN', secondary: true, cell: (row) => <span className="tabular">{String(row.gstin ?? '—')}</span> },
          {
            id: 'credit',
            header: 'Credit limit',
            align: 'right',
            cell: (row) => <span className="tabular">{row.creditLimit ? formatMoney(Number(row.creditLimit)) : '—'}</span>,
          },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'ACTIVE')} /> },
        ],
        fields: [
          { name: 'companyName', label: 'Company name', required: true },
          { name: 'adminEmail', label: 'Admin email', kind: 'email', required: true },
          { name: 'gstin', label: 'GSTIN' },
          { name: 'creditLimit', label: 'Credit limit', kind: 'number' },
        ],
      })}
    />
  );
}
