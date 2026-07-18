import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { AddEmployeeDto, BrandingDto, RegisterPartnerDto, CreateCorporateDto, CreateDsrDto, CreateLeadDto, CreateMaintenanceDto, CreatePlatformStaffDto, CreateStaffDto, CreateVersionDto, GenerateInvoiceDto, GenerateKeyDto, LogDeploymentDto, NoteDto, RecordConsentDto, RecordPaymentDto, RegisterChannelDto, RegisterJobDto, RegisterWebhookDto, RejectDto, RotateKeyDto } from '@/core/api/generated/dtos';

/* ------------------------------------------------------------------ *
 * The platform (SuperAdmin / Accountant) surface.
 * One thin, typed function per backend route — no logic, no caching.
 * Caching and invalidation belong to React Query; this layer only speaks HTTP.
 * ------------------------------------------------------------------ */

export interface Operator {
  id: string;
  legalName: string;
  brandName: string;
  email: string;
  phone?: string;
  status: string;
  commissionRate?: number;
  createdAt: string;
}



export interface SaasInvoice {
  id: string;
  invoiceNumber: string;
  operatorId: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  role: string | null;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
}


export const operatorsApi = {
  list: (params?: ListParams) => http.get<Operator[]>('/operators', { params }),
  get: (id: string) => http.get<Operator>(`/operators/${id}`),
  apply: (body: CreateLeadDto) => http.post<unknown>('/operators/apply', body),
  leads: (params?: ListParams) => http.get<Operator[]>('/operators/leads', { params }),
  lead: (id: string) => http.get<Operator>(`/operators/leads/${id}`),
  markContacted: (id: string) => http.patch<unknown>(`/operators/leads/${id}/contacted`),
  startVerification: (id: string) => http.patch<unknown>(`/operators/leads/${id}/verify`),
  approveLead: (id: string) => http.patch<unknown>(`/operators/leads/${id}/approve`),
  rejectLead: (id: string, body?: RejectDto) => http.patch<unknown>(`/operators/leads/${id}/reject`, body),
  setCommission: (id: string, commissionRate: number) =>
    http.patch<Operator>(`/operators/${id}/commission`, { commissionRate }),
  suspend: (id: string) => http.patch<Operator>(`/operators/${id}/suspend`),
  activate: (id: string) => http.patch<Operator>(`/operators/${id}/activate`),
  branding: (id: string) => http.get<Record<string, unknown>>(`/operators/${id}/branding`),
  updateMyBranding: (body: BrandingDto) => http.patch<unknown>('/operators/branding/me', body),
  scorecard: (id: string) => http.get<Record<string, unknown>>(`/operators/${id}/scorecard`),
  leaderboard: () => http.get<Array<Record<string, unknown>>>('/operators/scorecards/leaderboard'),
};



export const saasBillingApi = {
  listInvoices: (params?: ListParams) => http.get<SaasInvoice[]>('/saas-billing/invoices', { params }),
  getInvoice: (id: string) => http.get<SaasInvoice>(`/saas-billing/invoices/${id}`),
  createInvoice: (body: GenerateInvoiceDto) => http.post<SaasInvoice>('/saas-billing/invoices', body),
  notes: (id: string) => http.get<Array<Record<string, unknown>>>(`/saas-billing/invoices/${id}/notes`),
  voidInvoice: (id: string) => http.post<unknown>(`/saas-billing/invoices/${id}/void`),
  recordPayment: (id: string, body: RecordPaymentDto) =>
    http.post<unknown>(`/saas-billing/invoices/${id}/payments`, body),
  creditNote: (id: string, body: NoteDto) =>
    http.post<unknown>(`/saas-billing/invoices/${id}/credit-notes`, body),
  debitNote: (id: string, body: NoteDto) =>
    http.post<unknown>(`/saas-billing/invoices/${id}/debit-notes`, body),
};

export const apiManagementApi = {
  listPartners: () => http.get<Array<Record<string, unknown>>>('/api-management/partners'),
  createPartner: (body: RegisterPartnerDto) => http.post<unknown>('/api-management/partners', body),
  approvePartner: (id: string) => http.patch<unknown>(`/api-management/partners/${id}/approve`),
  rejectPartner: (id: string) => http.patch<unknown>(`/api-management/partners/${id}/reject`),
  suspendPartner: (id: string) => http.patch<unknown>(`/api-management/partners/${id}/suspend`),
  reactivatePartner: (id: string) => http.patch<unknown>(`/api-management/partners/${id}/reactivate`),
  listKeys: (id: string) => http.get<Array<Record<string, unknown>>>(`/api-management/partners/${id}/keys`),
  createKey: (id: string, body?: GenerateKeyDto) => http.post<unknown>(`/api-management/partners/${id}/keys`, body),
  revokeKey: (keyId: string) => http.patch<unknown>(`/api-management/keys/${keyId}/revoke`),
  listWebhooks: (id: string) => http.get<Array<Record<string, unknown>>>(`/api-management/partners/${id}/webhooks`),
  createWebhook: (id: string, body: RegisterWebhookDto) =>
    http.post<unknown>(`/api-management/partners/${id}/webhooks`, body),
  testWebhook: (webhookId: string) => http.post<unknown>(`/api-management/webhooks/${webhookId}/test`),
  deliveries: (webhookId: string) => http.get<Array<Record<string, unknown>>>(`/api-management/webhooks/${webhookId}/deliveries`),
  listVersions: () => http.get<Array<Record<string, unknown>>>('/api-management/versions'),
  createVersion: (body: CreateVersionDto) => http.post<unknown>('/api-management/versions', body),
  deprecateVersion: (id: string) => http.patch<unknown>(`/api-management/versions/${id}/deprecate`),
  retireVersion: (id: string) => http.patch<unknown>(`/api-management/versions/${id}/retire`),
};


export const complianceApi = {
  listRequests: () => http.get<Array<Record<string, unknown>>>('/platform/compliance/requests'),
  createRequest: (body: CreateDsrDto) => http.post<unknown>('/platform/compliance/requests', body),
  setRequestStatus: (id: string, body: Record<string, unknown>) =>
    http.patch<unknown>(`/platform/compliance/requests/${id}/status`, body),
  listConsent: () => http.get<Array<Record<string, unknown>>>('/platform/compliance/consent'),
  recordConsent: (body: RecordConsentDto) => http.post<unknown>('/platform/compliance/consent', body),
  rotateKeys: (body?: RotateKeyDto) => http.post<unknown>('/platform/compliance/keys/rotate', body),
  keyRotations: () => http.get<Array<Record<string, unknown>>>('/platform/compliance/keys/rotations'),
};

export const reliabilityApi = {
  listJobs: () => http.get<Array<Record<string, unknown>>>('/platform/reliability/jobs'),
  createJob: (body: RegisterJobDto) => http.post<unknown>('/platform/reliability/jobs', body),
  setJobStatus: (id: string, body: Record<string, unknown>) =>
    http.patch<unknown>(`/platform/reliability/jobs/${id}/status`, body),
  retryJob: (id: string) => http.patch<unknown>(`/platform/reliability/jobs/${id}/retry`),
  listDeployments: () => http.get<Array<Record<string, unknown>>>('/platform/reliability/deployments'),
  createDeployment: (body: LogDeploymentDto) => http.post<unknown>('/platform/reliability/deployments', body),
  deploy: (id: string) => http.patch<unknown>(`/platform/reliability/deployments/${id}/deploy`),
  rollback: (id: string) => http.patch<unknown>(`/platform/reliability/deployments/${id}/rollback`),
  impersonate: (userId: string) => http.post<unknown>(`/platform/reliability/impersonate/${userId}`),
  impersonations: () => http.get<Array<Record<string, unknown>>>('/platform/reliability/impersonations'),
};

export const corporateApi = {
  list: () => http.get<Array<Record<string, unknown>>>('/corporate'),
  create: (body: CreateCorporateDto) => http.post<unknown>('/corporate', body),
  employees: (id: string) => http.get<Array<Record<string, unknown>>>(`/corporate/${id}/employees`),
  addEmployee: (id: string, body: AddEmployeeDto) => http.post<unknown>(`/corporate/${id}/employees`, body),
  statement: (id: string) => http.get<Record<string, unknown>>(`/corporate/${id}/statement`),
};


export const analyticsApi = {
  platform: (params?: ListParams) => http.get<Record<string, unknown>>('/analytics/platform', { params }),
  operator: (params?: ListParams) => http.get<Record<string, unknown>>('/analytics/operator', { params }),
};

export const auditApi = {
  list: (params?: ListParams) => http.get<AuditEntry[]>('/audit', { params }),
};

export const adminApi = {
  operatorBuses: (id: string) => http.get<Array<Record<string, unknown>>>(`/admin/operators/${id}/buses`),
  operatorDrivers: (id: string) => http.get<Array<Record<string, unknown>>>(`/admin/operators/${id}/drivers`),
  operatorRoutes: (id: string) => http.get<Array<Record<string, unknown>>>(`/admin/operators/${id}/routes`),
  operatorTrips: (id: string) => http.get<Array<Record<string, unknown>>>(`/admin/operators/${id}/trips`),
  operatorBookings: (id: string) => http.get<Array<Record<string, unknown>>>(`/admin/operators/${id}/bookings`),
  operatorBilling: (id: string) => http.get<Record<string, unknown>>(`/admin/operators/${id}/billing`),
  logs: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/admin/logs', { params }),
};

export const healthApi = {
  check: () => http.get<Record<string, unknown>>('/health'),
};

export const maintenanceApi = {
  current: () => http.get<Record<string, unknown> | null>('/maintenance/current'),
  list: () => http.get<Array<Record<string, unknown>>>('/maintenance'),
  create: (body: CreateMaintenanceDto) => http.post<unknown>('/maintenance', body),
  remove: (id: string) => http.delete<unknown>(`/maintenance/${id}`),
};

export const notificationsApi = {
  mine: () => http.get<Array<Record<string, unknown>>>('/notifications/mine'),
  log: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/notifications/log', { params }),
  stats: () => http.get<Record<string, unknown>>('/notifications/stats'),
};

export const channelsApi = {
  list: () => http.get<Array<Record<string, unknown>>>('/channels'),
  create: (body: RegisterChannelDto) => http.post<unknown>('/channels', body),
  inventory: (tripId: string) => http.get<Record<string, unknown>>(`/channels/inventory/${tripId}`),
};

export interface StaffRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  operatorId: string | null;
  isActive: boolean;
  createdAt: string;
}

export const platformUsersApi = {
  /** An OPERATOR ADMIN's own staff — Support and Drivers inside their operator. */
  listStaff: (params?: ListParams) => http.get<StaffRow[]>('/users/staff', { params }),
  createStaff: (body: CreateStaffDto) => http.post<unknown>('/users/staff', body),

  /**
   * Yoo Bus's OWN team — Accountant and Platform Support, who belong to no operator.
   *
   * A different endpoint on purpose: /users/staff is OPERATOR_ADMIN-only, so a SuperAdmin
   * calling it got a 403 and could never create the platform's own people at all.
   */
  listPlatformStaff: (params?: ListParams) => http.get<StaffRow[]>('/users/platform-staff', { params }),
  createPlatformStaff: (body: CreatePlatformStaffDto) => http.post<unknown>('/users/platform-staff', body),
};
