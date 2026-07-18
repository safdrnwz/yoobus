import { IsUUID } from 'class-validator';
export class SeatAvailabilityDto { @IsUUID() boardingStopId: string; @IsUUID() droppingStopId: string; }
