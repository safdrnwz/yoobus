import { IsUUID } from 'class-validator';
export class FreezeFareDto {
  @IsUUID() boardingStopId: string;
  @IsUUID() droppingStopId: string;
}
