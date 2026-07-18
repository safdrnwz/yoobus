import { Injectable } from '@nestjs/common';
import { TripsService } from '../../operator/trips/trips.service';
import { arrivalMinutes, isValidConnection } from '../../../common/logic/connection.util';

function minToHHmm(min: number): string {
  const dayMin = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(dayMin / 60), m = dayMin % 60;
  const dayOffset = Math.floor(min / 1440);
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return dayOffset > 0 ? `${base} (+${dayOffset}d)` : base;
}

const MAX_RESULTS = 40;
const MAX_CONNECTIONS_CAP = 2; // up to 2 connections (3 legs)

interface Enriched { trip: any; route: any; bus: any; stops: any[]; byId: Map<string, any>; }
interface Leg { tripId: string; operatorId: string; routeName: string; from: string; to: string; departureTime: string; arrivalTime: string; fare: number; arriveMin: number; departMin: number; }

/**
 * Read-only connecting-journey search. Returns direct trips plus journeys with up to
 * `maxConnections` connections (default 1, capped at 2), across operators, honoring layover.
 * Trip loading and segment fares are reused from TripsService (single home).
 */
@Injectable()
export class JourneySearchService {
  constructor(private readonly trips: TripsService) {}

  async search(fromStopId: string, toStopId: string, date?: string, minLayover = 20, maxLayover = 360, maxConnections = 1, operatorId?: string | null) {
    const hops = Math.min(Math.max(maxConnections, 0), MAX_CONNECTIONS_CAP);
    const direct = await this.trips.search(fromStopId, toStopId, date, operatorId);

    const cands = await this.trips.candidatesForDate(date, operatorId);
    const enriched: Enriched[] = cands.map((c) => {
      const stops = c.route.routeStops.map((rs: any) => ({ stopId: rs.stopId, order: rs.stopOrder, offset: rs.arrivalOffsetMin, name: rs.stop?.name ?? rs.stopId }));
      return { trip: c.trip, route: c.route, bus: c.bus, stops, byId: new Map(stops.map((s: any) => [s.stopId, s])) };
    });

    // Index: which trips pass through a given stop (with that stop's entry).
    const passing = new Map<string, { e: Enriched; entry: any }[]>();
    for (const e of enriched) for (const s of e.stops) {
      if (!passing.has(s.stopId)) passing.set(s.stopId, []);
      passing.get(s.stopId)!.push({ e, entry: s });
    }

    const journeys: any[] = [];
    const buildLeg = (e: Enriched, board: any, drop: any): Leg | null => {
      const fare = this.trips.segmentFareFor(e.route, board.stopId, drop.stopId, Number(e.trip.fareMultiplier));
      if (fare <= 0) return null;
      const departMin = arrivalMinutes(e.trip.departureTime, board.offset);
      const arriveMin = arrivalMinutes(e.trip.departureTime, drop.offset);
      return { tripId: e.trip.id, operatorId: e.trip.operatorId, routeName: e.route.name, from: board.name, to: drop.name,
        departureTime: minToHHmm(departMin), arrivalTime: minToHHmm(arriveMin), fare, arriveMin, departMin };
    };

    const record = (legs: Leg[]) => {
      const totalFare = Math.round(legs.reduce((s, l) => s + l.fare, 0) * 100) / 100;
      journeys.push({
        type: legs.length === 1 ? 'DIRECT' : 'CONNECTING',
        connections: legs.length - 1,
        totalFare,
        totalDurationMin: legs[legs.length - 1].arriveMin - legs[0].departMin,
        legs: legs.map(({ arriveMin, departMin, ...pub }) => pub),
      });
    };

    // Depth-first expansion, boarding at `stopId`, arrived at `arrivedMin` (null at origin).
    const expand = (stopId: string, arrivedMin: number | null, legs: Leg[], usedTripIds: Set<string>, visitedStops: Set<string>) => {
      if (journeys.length >= MAX_RESULTS) return;
      const options = passing.get(stopId) ?? [];
      for (const { e, entry } of options) {
        if (usedTripIds.has(e.trip.id)) continue;
        const departMin = arrivalMinutes(e.trip.departureTime, entry.offset);
        if (arrivedMin !== null && !isValidConnection(arrivedMin, departMin, minLayover, maxLayover).ok) continue;
        // Can we reach destination on this trip?
        const toS = e.byId.get(toStopId);
        if (toS && toS.order > entry.order) {
          const leg = buildLeg(e, entry, toS);
          if (leg && legs.length >= 1) record([...legs, leg]); // legs already has >=1 => this is a connection
        }
        // Extend via an intermediate hub, if hops remain.
        if (legs.length < hops) {
          for (const hub of e.stops) {
            if (hub.order <= entry.order || hub.stopId === toStopId || visitedStops.has(hub.stopId)) continue;
            const leg = buildLeg(e, entry, hub);
            if (!leg) continue;
            expand(hub.stopId, leg.arriveMin, [...legs, leg], new Set([...usedTripIds, e.trip.id]), new Set([...visitedStops, stopId]));
            if (journeys.length >= MAX_RESULTS) return;
          }
        }
      }
    };

    // Seed: from origin, board any trip that has fromStop; then expand toward hubs.
    for (const { e, entry } of passing.get(fromStopId) ?? []) {
      for (const hub of e.stops) {
        if (hub.order <= entry.order || hub.stopId === toStopId) continue;
        const leg = buildLeg(e, entry, hub);
        if (!leg) continue;
        expand(hub.stopId, leg.arriveMin, [leg], new Set([e.trip.id]), new Set([fromStopId]));
        if (journeys.length >= MAX_RESULTS) break;
      }
      if (journeys.length >= MAX_RESULTS) break;
    }

    journeys.sort((a, b) => a.totalFare - b.totalFare);
    return { fromStopId, toStopId, date: date ?? null, maxConnections: hops, directCount: direct.length, connectingCount: journeys.length, direct, connecting: journeys };
  }
}
