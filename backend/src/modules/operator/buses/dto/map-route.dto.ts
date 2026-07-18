import { IsUUID } from 'class-validator';
export class MapRouteDto { @IsUUID() routeId: string; }
