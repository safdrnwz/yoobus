import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LineItemDto {
  @IsString() @MaxLength(120) description: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
}

export class GenerateInvoiceDto {
  @IsString() operatorId: string;
  @IsOptional() @IsString() customerGstin?: string;
  @IsOptional() @IsString() customerStateCode?: string;
  @IsOptional() @IsNumber() @Min(0) gstRate?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsOptional() @IsNumber() @Min(0) dueDays?: number;
}

export class RecordPaymentDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsIn(['ONLINE', 'BANK_TRANSFER', 'UPI', 'WALLET', 'OFFLINE']) method: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

export class NoteDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @MaxLength(200) reason: string;
}
