import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class SetOperatorPrefDto {
  @IsString() @MaxLength(40) notificationKey: string;
  @IsIn(['EMAIL', 'SMS', 'WHATSAPP']) channel: string;
  @IsBoolean() enabled: boolean;
}
