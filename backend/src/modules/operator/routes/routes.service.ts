import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { RouteStop } from './entities/route-stop.entity';
import { AppException } from '../../../common/errors/app-exception';
import { StopsService } from '../stops/stops.service';
import { canDelete } from '../../../common/logic/delete-permission.util';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatus } from '../../../common/enums/trip-status.enum';


@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly repo: Repository<Route>,
    private readonly stops: StopsService,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
  ) {}

  async create(operatorId: string, dto: any) {
    const sorted = [...dto.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const orders = sorted.map((s) => s.stopOrder);
    if (new Set(orders).size !== orders.length)
      throw new AppException('ROUTE_DUP_ORDER', 'stopOrder values must not be duplicated', HttpStatus.BAD_REQUEST);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].stopOrder !== i) throw new AppException('ROUTE_ORDER_SEQ', 'stopOrder must be sequential starting from 0', HttpStatus.BAD_REQUEST);
      if (i > 0 && sorted[i].fareFromOrigin < sorted[i - 1].fareFromOrigin)
        throw new AppException('ROUTE_FARE_DECREASING', 'fareFromOrigin must increase at each subsequent stop', HttpStatus.BAD_REQUEST);
    }
    if (sorted[0].fareFromOrigin !== 0)
      throw new AppException('ROUTE_ORIGIN_FARE', 'Origin (order 0) fare must be 0', HttpStatus.BAD_REQUEST);
    const stopIds = sorted.map((s) => s.stopId);
    if (new Set(stopIds).size !== stopIds.length)
      throw new AppException('ROUTE_DUP_STOP', 'A stop cannot appear twice in a route', HttpStatus.BAD_REQUEST);
    const found = await this.stops.findByIds(stopIds);
    if (found.length !== stopIds.length)
      throw new AppException('ROUTE_INVALID_STOP', 'Some stopId values are invalid', HttpStatus.BAD_REQUEST);

    return this.repo.save(this.repo.create({
      operatorId, name: dto.name,
      routeStops: sorted.map((s) => Object.assign(new RouteStop(), {
        stopId: s.stopId, stopOrder: s.stopOrder, fareFromOrigin: s.fareFromOrigin, arrivalOffsetMin: s.arrivalOffsetMin ?? 0,
      })),
    }));
  }

  listByOperator(operatorId: string, includeDeleted = false) { return this.repo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, withDeleted: includeDeleted }); }

  async findById(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new AppException('ROUTE_NOT_FOUND', 'Route not found', HttpStatus.NOT_FOUND);
    r.routeStops.sort((a, b) => a.stopOrder - b.stopOrder);
    return r;
  }

  async update(operatorId: string, id: string, patch: { name?: string; isActive?: boolean }) {
    const r = await this.findById(id);
    if (r.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Route does not belong to your operator', HttpStatus.FORBIDDEN);
    if (patch.name !== undefined) r.name = patch.name;
    if (patch.isActive !== undefined) r.isActive = patch.isActive;
    return this.repo.save(r);
  }

  async adminSoftDelete(role: string, id: string) {
    const perm = canDelete(role, 'ROUTE');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    await this.repo.softDelete(id);
    return { id, deleted: true };
  }

  async softDelete(role: string, operatorId: string, id: string) {
    const perm = canDelete(role, 'ROUTE');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    const r = await this.findById(id);
    if (r.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Route does not belong to your operator', HttpStatus.FORBIDDEN);
    const active = await this.tripRepo.count({ where: { routeId: id, status: TripStatus.SCHEDULED } });
    if (active > 0) throw new AppException('ROUTE_HAS_TRIPS', 'Route has scheduled trips', HttpStatus.CONFLICT);
    await this.repo.softDelete(id);
    return { id, deleted: true };
  }
}