import { IsUUID } from 'class-validator';
export class RescheduleDto { @IsUUID() newTripId: string; }
