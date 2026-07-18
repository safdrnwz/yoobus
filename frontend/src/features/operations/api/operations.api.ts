import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { AdjustSeatFaresDto, AssignBusDto, AttachRouteDto, CreateAgentDto, CreateBusDto, CreateCounterDto, CreateDriverDto, CreateHubDto, CreateRouteDto, CreateScheduleDto, CreateStopDto, FreezeFareDto, GenerateTripsDto, LadiesReservedDto, RecordSaleDto, SeatAdjacencyDto, SetSeatFaresDto, UpdateBusDto, UpdateDriverDto, UpdateRouteDto } from '@/core/api/generated/dtos';

/* The operator's own world: fleet, network, schedules, trips, crew, counters. */

/**
 * A bus, as the server actually returns it.
 *
 * `name`, `seatMap` and `seatLayout` were missing from this type even though the server has
 * always sent them — so any screen that reached for them silently got `undefined`, and the
 * seat-configuration screen could not be written at all.
 */
export interface Bus {
  id: string;
  registrationNumber: string;
  name: string;
  busType: string;
  totalSeats: number;
  isActive: boolean;
  routeId?: string | null;
  amenities?: string[];
  /** The seat names, in order. The source of truth for how many seats there are. */
  seatMap?: string[];
  /** The physical arrangement, if the operator gave one. */
  seatLayout?: { decks?: Array<{ rows?: number; cols?: number }> } | null;
  ladiesReservedSeats?: string[];
  seatAdjacency?: Record<string, string>;
  /** What each seat is worth, relative to the others. A missing seat is a standard seat. */
  seatFares?: Record<string, { multiplier: number; delta?: number }>;
}

export interface BusRoute {
  id: string;
  name: string;
  source: string;
  destination: string;
  distanceKm?: number;
  durationMinutes?: number;
  isActive?: boolean;
}

export interface Stop {
  id: string;
  name: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface Driver {
  id: string;
  fullName: string;
  phone?: string;
  licenseNumber?: string;
  busId?: string | null;
  isActive?: boolean;
}

export interface Schedule {
  id: string;
  routeId: string;
  busId: string;
  departureTime: string;
  status: string;
  recurrence?: string;
}

export const busesApi = {
  list: (params?: ListParams) => http.get<Bus[]>('/buses', { params }),
  create: (body: CreateBusDto) => http.post<Bus>('/buses', body),
  update: (id: string, body: UpdateBusDto) => http.patch<Bus>(`/buses/${id}`, body),
  assignRoute: (id: string, routeId: string) => http.patch<Bus>(`/buses/${id}/route`, { routeId }),
  activate: (id: string) => http.patch<Bus>(`/buses/${id}/activate`),
  deactivate: (id: string) => http.patch<Bus>(`/buses/${id}/deactivate`),
  setLadiesReserved: (id: string, body: LadiesReservedDto) =>
    http.patch<Bus>(`/buses/${id}/ladies-reserved`, body),
  setSeatAdjacency: (id: string, body: SeatAdjacencyDto) =>
    http.patch<Bus>(`/buses/${id}/seat-adjacency`, body),
  /** Operator-only. A passenger reads the seat map from tripsApi.seats() instead. */
  seatConfig: (id: string) =>
    http.get<{ busId: string; ladiesReservedSeats: string[]; seatAdjacency: Record<string, string> }>(
      `/buses/${id}/seat-config`,
    ),

  /** Set exact price rules. Seats not mentioned keep what they had. */
  setSeatFares: (id: string, body: SetSeatFaresDto) => http.put<Bus>(`/buses/${id}/seat-fares`, body),

  /** "Everything up 5%" — or just the front half, or just the back row. */
  adjustSeatFares: (id: string, body: AdjustSeatFaresDto) =>
    http.patch<Bus>(`/buses/${id}/seat-fares/adjust`, body),
  remove: (id: string) => http.delete<unknown>(`/buses/${id}`),
};

export const routesApi = {
  list: (params?: ListParams) => http.get<BusRoute[]>('/routes', { params }),
  get: (id: string) => http.get<BusRoute>(`/routes/${id}`),
  create: (body: CreateRouteDto) => http.post<BusRoute>('/routes', body),
  update: (id: string, body: UpdateRouteDto) => http.patch<BusRoute>(`/routes/${id}`, body),
  remove: (id: string) => http.delete<unknown>(`/routes/${id}`),
};

export const stopsApi = {
  list: (params?: ListParams) => http.get<Stop[]>('/stops', { params }),
  create: (body: CreateStopDto) => http.post<Stop>('/stops', body),
};

export const driversApi = {
  list: (params?: ListParams) => http.get<Driver[]>('/drivers', { params }),
  create: (body: CreateDriverDto) => http.post<Driver>('/drivers', body),
  update: (id: string, body: UpdateDriverDto) => http.patch<Driver>(`/drivers/${id}`, body),
  assign: (id: string, body: AssignBusDto) => http.patch<Driver>(`/drivers/${id}/assign`, body),
  unassign: (id: string) => http.patch<Driver>(`/drivers/${id}/unassign`),
  remove: (id: string) => http.delete<unknown>(`/drivers/${id}`),
};

export const schedulesApi = {
  list: (params?: ListParams) => http.get<Schedule[]>('/operator/schedules', { params }),
  create: (body: CreateScheduleDto) => http.post<Schedule>('/operator/schedules', body),
  activate: (id: string) => http.patch<Schedule>(`/operator/schedules/${id}/activate`),
  suspend: (id: string) => http.patch<Schedule>(`/operator/schedules/${id}/suspend`),
  /** Dry run: shows which trips would be created before anything is written. */
  preview: (id: string, body: GenerateTripsDto) =>
    http.post<Array<Record<string, unknown>>>(`/operator/schedules/${id}/preview`, body),
  generate: (id: string, body: GenerateTripsDto) =>
    http.post<Array<Record<string, unknown>>>(`/operator/schedules/${id}/generate`, body),
};

/** One seat as the server describes it. These key names are the server's, not ours. */
export interface Seat {
  seatNumber: string;
  available: boolean;
  /** Held for women. On a FREE seat this means "available for female only" — pink outline. */
  ladiesReserved: boolean;
  /**
   * Who is sitting there — only ever set on a seat that is actually taken.
   *
   * A woman travelling alone has to see, before she taps, who is already sitting beside a
   * seat. It is the most common reason a female passenger abandons a booking. We publish the
   * occupant's gender and nothing else: no name, no age, no booking id.
   */
  bookedBy?: 'MALE' | 'FEMALE';
  /** THIS seat's price on THIS segment. Seats are no longer all the same price. */
  fare: number;
  priceBand: 'PREMIUM' | 'STANDARD' | 'SAVER';
}

/** A deck of the physical bus. The UI draws whatever the server says — it invents nothing. */
export interface SeatDeck {
  rows: number;
  cols: number;
  cells?: Array<{ type?: string; seatNumber?: string; row?: number; col?: number }>;
}

export interface TripSeatMap {
  tripId: string;
  busName?: string;
  busType?: string;
  /** A STANDARD seat's price. Individual seats may differ — read seats[].fare. */
  farePerSeat: number;
  fareFrom: number;
  fareTo: number;
  totalSeats: number;
  availableCount: number;
  seats: Seat[];
  /** Physical arrangement. Null on buses that were never given one. */
  seatLayout: { decks?: SeatDeck[] } | null;
  ladiesReservedSeats: string[];
  seatAdjacency: Record<string, string>;
  fromName?: string;
  toName?: string;
  date?: string;
}

export const tripsApi = {
  /**
   * The seat map a passenger books from.
   *
   * NOT /buses/:id/seat-config — that takes a BUS id (the booking screen was passing a TRIP
   * id) and is OPERATOR_ADMIN-only, so a passenger got a 403 and never saw a seat at all.
   */
  seats: (tripId: string, boardingStopId: string, droppingStopId: string) =>
    http.get<TripSeatMap>(`/trips/${tripId}/seats`, { params: { boardingStopId, droppingStopId } }),
  fareFreeze: (id: string, body: FreezeFareDto) => http.post<unknown>(`/trips/${id}/fare-freeze`, body),
  pricing: (id: string) => http.get<Record<string, unknown>>(`/pricing/trips/${id}`),
};

export const hubsApi = {
  list: () => http.get<Array<Record<string, unknown>>>('/operator/hubs'),
  create: (body: CreateHubDto) => http.post<unknown>('/operator/hubs', body),
  routes: (hubId: string) => http.get<Array<Record<string, unknown>>>(`/operator/hubs/${hubId}/routes`),
  addRoute: (hubId: string, body: AttachRouteDto) => http.post<unknown>(`/operator/hubs/${hubId}/routes`, body),
  removeRoute: (id: string) => http.delete<unknown>(`/operator/hubs/routes/${id}`),
};

export const countersApi = {
  list: () => http.get<Array<Record<string, unknown>>>('/operator/counters'),
  create: (body: CreateCounterDto) => http.post<unknown>('/operator/counters', body),
  agents: () => http.get<Array<Record<string, unknown>>>('/operator/counters/agents'),
  addAgent: (body: CreateAgentDto) => http.post<unknown>('/operator/counters/agents', body),
  recordSale: (body: RecordSaleDto) => http.post<unknown>('/operator/counters/sale', body),
  closing: (id: string) => http.get<Record<string, unknown>>(`/operator/counters/${id}/closing`),
};


export const operatorDashboardApi = {
  get: () => http.get<Record<string, unknown>>('/operator/dashboard'),
};
