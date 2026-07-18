import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { BlacklistDto, CreateComplaintDto, CreateTicketDto, LostFoundDto } from '@/core/api/generated/dtos';

/* Support desk: tickets, complaints, lost & found, and the passenger blacklist. */

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority?: string;
  category?: string;
  assignedTo?: string | null;
  createdAt: string;
}

export const supportApi = {
  listTickets: (params?: ListParams) => http.get<SupportTicket[]>('/operator/support/tickets', { params }),
  createTicket: (body: CreateTicketDto) => http.post<SupportTicket>('/operator/support/tickets', body),
  assign: (id: string, body: Record<string, unknown>) => http.patch<unknown>(`/operator/support/tickets/${id}/assign`, body),
  escalate: (id: string, body?: Record<string, unknown>) => http.patch<unknown>(`/operator/support/tickets/${id}/escalate`, body),
  resolve: (id: string, body?: Record<string, unknown>) => http.patch<unknown>(`/operator/support/tickets/${id}/resolve`, body),
  close: (id: string) => http.patch<unknown>(`/operator/support/tickets/${id}/close`),

  listComplaints: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/support/complaints', { params }),
  createComplaint: (body: CreateComplaintDto) => http.post<unknown>('/operator/support/complaints', body),
  resolveComplaint: (id: string, body?: Record<string, unknown>) =>
    http.patch<unknown>(`/operator/support/complaints/${id}/resolve`, body),
  reopenComplaint: (id: string) => http.patch<unknown>(`/operator/support/complaints/${id}/reopen`),

  listLostFound: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/support/lost-found', { params }),
  createLostFound: (body: LostFoundDto) => http.post<unknown>('/operator/support/lost-found', body),
  closeLostFound: (id: string) => http.patch<unknown>(`/operator/support/lost-found/${id}/close`),

  listBlacklist: () => http.get<Array<Record<string, unknown>>>('/operator/support/blacklist'),
  addToBlacklist: (body: BlacklistDto) => http.post<unknown>('/operator/support/blacklist', body),
};
