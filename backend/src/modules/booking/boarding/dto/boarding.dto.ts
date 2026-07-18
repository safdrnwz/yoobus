import { IsString, IsUUID, MaxLength } from 'class-validator';
export class ScanDto {
  @IsUUID() tripId: string;
  @IsString() @MaxLength(40) qrPayload: string; // e.g. "TICKET:ABCD1234"
}
export class ManualBoardDto {
  @IsUUID() tripId: string;
  @IsString() @MaxLength(12) pnr: string;
}
