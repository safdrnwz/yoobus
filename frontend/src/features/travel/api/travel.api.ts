import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { RedeemPointsDto, RedeemReferralDto, SavePassengerDto, TopupDto, UpdateProfileDto, WalletPayDto } from '@/core/api/generated/dtos';

/* The passenger's own account: profile, saved travellers, wallet and rewards. */

export const profileApi = {
  me: () => http.get<Record<string, unknown>>('/me'),
  completion: () => http.get<Record<string, unknown>>('/me/profile-completion'),
  update: (body: UpdateProfileDto) => http.patch<Record<string, unknown>>('/me', body),
  deleteAccount: () => http.delete<unknown>('/me'),
  dashboard: () => http.get<Record<string, unknown>>('/me/dashboard'),
  bookings: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/me/bookings', { params }),
  savedPassengers: () => http.get<Array<Record<string, unknown>>>('/me/passengers'),
  addPassenger: (body: SavePassengerDto) => http.post<unknown>('/me/passengers', body),
  removePassenger: (id: string) => http.delete<unknown>(`/me/passengers/${id}`),
};

export const walletApi = {
  get: () => http.get<Record<string, unknown>>('/wallet'),
  topUp: (body: TopupDto) => http.post<Record<string, unknown>>('/wallet/topup', body),
  pay: (body: WalletPayDto) => http.post<Record<string, unknown>>('/wallet/pay', body),
};

export const loyaltyApi = {
  get: () => http.get<Record<string, unknown>>('/loyalty'),
  redeemReferral: (body: RedeemReferralDto) => http.post<unknown>('/loyalty/referral/redeem', body),
  redeemPoints: (body: RedeemPointsDto) => http.post<unknown>('/loyalty/points/redeem', body),
};
