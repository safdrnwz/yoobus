import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripLocation } from './entities/trip-location.entity';
import { Stop } from '../../operator/stops/entities/stop.entity';
import { TripsService } from '../../operator/trips/trips.service';
import { assertOperatorScope } from '../../../common/logic/access.util';
import { AppException } from '../../../common/errors/app-exception';
import { haversineKm, etaMinutes } from '../../../common/logic/eta.util';

// OSM note: production me map tiles + routing self-hosted (OSRM/Nominatim).
// Yahan latest position store + haversine ETA (engine swap easy).
@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(TripLocation) private readonly locRepo: Repository<TripLocation>,
    @InjectRepository(Stop) private readonly stopRepo: Repository<Stop>,
    private readonly trips: TripsService,
  ) {}

  // Driver app/device GPS ping (upsert latest)
  async ping(operatorId: string | null, role: string, dto: { tripId: string; latitude: number; longitude: number; speedKmph?: number }) {
    const { trip } = await this.trips.findFull(dto.tripId);
    const scope = assertOperatorScope(role, operatorId, trip.operatorId);
    if (!scope.ok) throw new AppException(scope.code!, scope.message!, HttpStatus.FORBIDDEN);
    let loc = await this.locRepo.findOne({ where: { tripId: dto.tripId } });
    if (!loc) loc = this.locRepo.create({ tripId: dto.tripId });
    loc.latitude = dto.latitude; loc.longitude = dto.longitude; loc.speedKmph = dto.speedKmph ?? 0;
    return this.locRepo.save(loc);
  }

  // Passenger: live position + next-stop ETA
  async live(tripId: string) {
    const loc = await this.locRepo.findOne({ where: { tripId } });
    if (!loc) throw new AppException('NO_LOCATION', 'Live location is not available yet', HttpStatus.NOT_FOUND);
    const { route } = await this.trips.findFull(tripId);
    // Approximates the next stop as the nearest one with known coordinates (simple heuristic).
    let nextStop: any = null, eta: number | null = null, dist: number | null = null;
    const stopsWithGeo = route.routeStops.filter((rs: any) => rs.stop?.latitude != null && rs.stop?.longitude != null);
    if (stopsWithGeo.length) {
      let best = Infinity;
      for (const rs of stopsWithGeo) {
        const d = haversineKm(loc.latitude, loc.longitude, rs.stop.latitude, rs.stop.longitude);
        if (d < best) { best = d; nextStop = rs.stop.name; dist = d; }
      }
      eta = etaMinutes(best);
    }
    return { tripId, latitude: loc.latitude, longitude: loc.longitude, speedKmph: loc.speedKmph, updatedAt: loc.updatedAt, nearestStop: nextStop, distanceKm: dist, etaMinutes: eta };
  }
}
