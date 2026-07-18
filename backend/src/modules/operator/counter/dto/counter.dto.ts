import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
export class CreateCounterDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string;
}
export class CreateAgentDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsUUID() counterId?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}
export class RecordSaleDto {
  @IsUUID() counterId: string;
  @IsUUID() agentId: string;
  @IsUUID() bookingId: string;
  @IsNumber() @Min(0) amount: number;
  @IsIn(['CASH', 'UPI', 'CARD']) paymentMode: string;
}
