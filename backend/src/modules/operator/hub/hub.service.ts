import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub, HubRoute } from './entities/hub.entities';
import { AttachRouteDto, CreateHubDto } from './dto/hub.dto';
import { Route } from '../routes/entities/route.entity';
import { AppException } from '../../../common/errors/app-exception';
import { classifyHubPosition, validateSpoke } from '../../../common/logic/hub.util';

/** Operator hub-and-spoke network: define hubs and attach routes as spokes. */
@Injectable()
export class HubService {
  constructor(
    @InjectRepository(Hub) private readonly hubRepo: Repository<Hub>,
    @InjectRepository(HubRoute) private readonly spokeRepo: Repository<HubRoute>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
  ) {}

  createHub(operatorId: string, dto: CreateHubDto): Promise<Hub> {
    return this.hubRepo.save(this.hubRepo.create({ operatorId, name: dto.name, stopId: dto.stopId, city: dto.city ?? null, active: true }));
  }
  listHubs(operatorId: string): Promise<Hub[]> {
    return this.hubRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  async attachRoute(operatorId: string, hubId: string, dto: AttachRouteDto): Promise<HubRoute> {
    const hub = await this.hubRepo.findOne({ where: { id: hubId } });
    if (!hub || hub.operatorId !== operatorId) throw new AppException('HUB_NOT_FOUND', 'Hub not found.', HttpStatus.NOT_FOUND);
    const route = await this.routeRepo.findOne({ where: { id: dto.routeId } });
    if (!route) throw new AppException('ROUTE_NOT_FOUND', 'Route not found.', HttpStatus.NOT_FOUND);
    route.routeStops.sort((a, b) => a.stopOrder - b.stopOrder);
    const stopIds = route.routeStops.map((rs) => rs.stopId);
    const spoke = validateSpoke(stopIds, hub.stopId);
    if (!spoke.ok) throw new AppException(spoke.code!, spoke.message!, HttpStatus.BAD_REQUEST);
    const hubStop = route.routeStops.find((rs) => rs.stopId === hub.stopId)!;
    const first = route.routeStops[0].stopOrder;
    const last = route.routeStops[route.routeStops.length - 1].stopOrder;
    const position = classifyHubPosition(hubStop.stopOrder, first, last);
    return this.spokeRepo.save(this.spokeRepo.create({ operatorId, hubId, routeId: dto.routeId, hubPosition: position }));
  }

  listSpokes(operatorId: string, hubId: string): Promise<HubRoute[]> {
    return this.spokeRepo.find({ where: { operatorId, hubId }, order: { createdAt: 'DESC' } });
  }

  async detachRoute(operatorId: string, id: string): Promise<{ detached: true }> {
    const s = await this.spokeRepo.findOne({ where: { id } });
    if (!s || s.operatorId !== operatorId) throw new AppException('SPOKE_NOT_FOUND', 'Spoke not found.', HttpStatus.NOT_FOUND);
    await this.spokeRepo.remove(s);
    return { detached: true };
  }
}
