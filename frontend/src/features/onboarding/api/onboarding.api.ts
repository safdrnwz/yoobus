import { http } from '@/core/api/http-client';
import type { CreateLeadDto } from '@/core/api/generated/dtos';

/** Public "Become an Operator" application — one form, no login. */
export const onboardingApi = {
  apply: (body: CreateLeadDto) => http.post<{ id: string }>('/operators/apply', body),
};
