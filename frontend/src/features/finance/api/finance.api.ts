import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { CreateCouponDto, PeriodDto, PostJournalDto, RunStatementDto, ValidateCouponDto } from '@/core/api/generated/dtos';

/* Money: fares, coupons, settlements, invoices, the ledger and the statutory reports. */

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
  usageLimit?: number;
}

export interface Settlement {
  id: string;
  operatorId: string;
  amount: number;
  status: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

export const couponsApi = {
  list: (params?: ListParams) => http.get<Coupon[]>('/coupons', { params }),
  create: (body: CreateCouponDto) => http.post<Coupon>('/coupons', body),
  /** Checks a code against a fare before the passenger commits to it. */
  validate: (body: ValidateCouponDto) => http.post<Record<string, unknown>>('/coupons/validate', body),
};

export const settlementsApi = {
  list: (params?: ListParams) => http.get<Settlement[]>('/settlements', { params }),
  preview: (params?: ListParams) => http.get<Record<string, unknown>>('/settlements/preview', { params }),
  create: (operatorId: string, body?: PeriodDto) => http.post<Settlement>(`/settlements/${operatorId}`, body),
  markPaid: (id: string, body?: Record<string, unknown>) => http.patch<Settlement>(`/settlements/${id}/paid`, body),
};

export const billingApi = {
  invoices: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/billing/invoices', { params }),
  commission: (params?: ListParams) => http.get<Record<string, unknown>>('/billing/commission', { params }),
  platformCommission: (params?: ListParams) => http.get<Record<string, unknown>>('/billing/platform/commission', { params }),
};

export const financeSummaryApi = {
  get: (params?: ListParams) => http.get<Record<string, unknown>>('/finance/summary', { params }),
};

export const operatorFinanceApi = {
  listJournal: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/finance/journal', { params }),
  createJournal: (body: PostJournalDto) => http.post<unknown>('/operator/finance/journal', body),
  trialBalance: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/finance/trial-balance', { params }),
  periods: () => http.get<Array<Record<string, unknown>>>('/operator/finance/periods'),
  closePeriod: (period: string) => http.patch<unknown>(`/operator/finance/periods/${period}/close`),
  reopenPeriod: (period: string) => http.patch<unknown>(`/operator/finance/periods/${period}/reopen`),
};

export const pricingApi = {
  forTrip: (tripId: string) => http.get<Record<string, unknown>>(`/pricing/trips/${tripId}`),
};

export const reportsApi = {
  revenue: (params?: ListParams) => http.get<Record<string, unknown>>('/reports/revenue', { params }),
  manifest: (tripId: string) => http.get<Array<Record<string, unknown>>>(`/reports/manifest/${tripId}`),
  gst: (params?: ListParams) => http.get<Record<string, unknown>>('/reports/gst', { params }),
};

export const dailyStatementApi = {
  run: (body?: RunStatementDto) => http.post<unknown>('/operator/daily-statement/run', body),
};
