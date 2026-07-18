import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { CancelBookingDto, CreateBookingDto, CreateOrderDto, CreateReviewDto, HoldDto, InitiateTransferDto, ManualBoardDto, OfferUpgradeDto, PartialCancelDto, RequestOtpDto, RescheduleDto, VerifyOtpDto, VerifyPaymentDto } from '@/core/api/generated/dtos';

/* Search → hold → pay → ticket, plus everything that happens to a booking afterwards. */

/**
 * Exactly what GET /trips/search returns.
 *
 * The old shape here was fiction — it had `source`/`destination` as free text and no stop
 * ids at all, while the server keys everything off stop UUIDs. The search therefore 400'd,
 * and even if it had not, holding a seat needs `boardingStopId`/`droppingStopId`, which the
 * client had no way to know. Both are now carried through.
 */
export interface JourneyResult {
  tripId: string;
  operatorId: string;
  routeName: string;
  bus: { name: string; type: string; registrationNumber: string };
  departureDate: string;
  departureTime: string;
  /** The stop ids the fare was quoted for — a seat hold needs these. */
  fromStopId: string;
  toStopId: string;
  from?: string;
  to?: string;
  farePerSeat: number;
  availableSeats: number;
}

export interface Booking {
  id: string;
  pnr: string;
  status: string;
  tripId: string;
  totalFare: number;
  seatNumbers?: string[];
  passengerName?: string;
  journeyDate?: string;
  createdAt: string;
}

export interface SeatMapSeat {
  seatNumber: string;
  isAvailable: boolean;
  isLadiesReserved?: boolean;
  fare?: number;
  deck?: string;
  type?: string;
}

export interface JourneySearchParams {
  /** Stop UUIDs, not city names — the server matches on stop ids. */
  fromStopId: string;
  toStopId: string;
  date: string;
}

export const journeyApi = {
  /** Public search — passengers use it before signing in. */
  search: (params: JourneySearchParams) => http.get<JourneyResult[]>('/trips/search', { params }),
};

export const bookingsApi = {
  list: (params?: ListParams) => http.get<Booking[]>('/bookings', { params }),
  mine: (params?: ListParams) => http.get<Booking[]>('/bookings/my', { params }),
  detail: (id: string) => http.get<Booking>(`/bookings/${id}/detail`),
  byPnr: (pnr: string) => http.get<Booking>(`/bookings/pnr/${pnr}`),

  /** Reserves the seats for the payment window; the hold expires on its own. */
  hold: (body: HoldDto) => http.post<Record<string, unknown>>('/bookings/hold', body),
  create: (body: CreateBookingDto) => http.post<Booking>('/bookings', body),

  cancel: (id: string, body?: CancelBookingDto) => http.patch<Booking>(`/bookings/${id}/cancel`, body),
  cancelSeats: (id: string, body: PartialCancelDto) => http.patch<Booking>(`/bookings/${id}/cancel-seats`, body),
  reschedule: (id: string, body: RescheduleDto) => http.patch<Booking>(`/bookings/${id}/reschedule`, body),

  /** The ticket comes back as a PDF stream, not JSON. */
  ticketPdf: (id: string) => http.blob(`/bookings/${id}/ticket.pdf`),
};

export const boardingApi = {
  manifest: (tripId: string) => http.get<Array<Record<string, unknown>>>(`/booking/boarding/trip/${tripId}`),
  scan: (body: { qrToken: string; [key: string]: unknown }) => http.post<Record<string, unknown>>('/booking/boarding/scan', body),
  manual: (body: ManualBoardDto) => http.post<unknown>('/booking/boarding/manual', body),
  markNoShow: (body: ManualBoardDto) => http.post<unknown>('/booking/boarding/no-show', body),
};

export const seatUpgradeApi = {
  createOffer: (body: OfferUpgradeDto) => http.post<unknown>('/booking/seat-upgrade/offers', body),
  apply: (id: string) => http.patch<unknown>(`/booking/seat-upgrade/offers/${id}/apply`),
  reject: (id: string) => http.patch<unknown>(`/booking/seat-upgrade/offers/${id}/reject`),
  forBooking: (bookingId: string) =>
    http.get<Array<Record<string, unknown>>>(`/booking/seat-upgrade/bookings/${bookingId}/offers`),
};

export const transferApi = {
  create: (body: InitiateTransferDto) => http.post<unknown>('/booking/transfer', body),
  approve: (id: string) => http.patch<unknown>(`/booking/transfer/${id}/approve`),
  execute: (id: string) => http.patch<unknown>(`/booking/transfer/${id}/execute`),
  cancel: (id: string) => http.patch<unknown>(`/booking/transfer/${id}/cancel`),
  forBooking: (bookingId: string) => http.get<Array<Record<string, unknown>>>(`/booking/transfer/bookings/${bookingId}`),
};

export const reviewsApi = {
  create: (body: CreateReviewDto) => http.post<unknown>('/reviews', body),
  forOperator: (operatorId: string, params?: ListParams) =>
    http.get<Array<Record<string, unknown>>>(`/reviews/operator/${operatorId}`, { params }),
  rating: (operatorId: string) => http.get<Record<string, unknown>>(`/reviews/operator/${operatorId}/rating`),
};

export const paymentsApi = {
  createOrder: (body: CreateOrderDto) => http.post<Record<string, unknown>>('/payments/razorpay/order', body),
  verify: (body: VerifyPaymentDto) => http.post<Record<string, unknown>>('/payments/razorpay/verify', body),
};

export const otpApi = {
  request: (body: RequestOtpDto) => http.post<Record<string, unknown>>('/otp/request', body),
  verify: (body: VerifyOtpDto) => http.post<Record<string, unknown>>('/otp/verify', body),
};
