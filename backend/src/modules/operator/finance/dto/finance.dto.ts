import { ArrayMinSize, IsArray, IsNumber, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class JournalLineDto {
  @IsString() @MaxLength(60) account: string;
  @IsNumber() @Min(0) debit: number;
  @IsNumber() @Min(0) credit: number;
}
export class PostJournalDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be YYYY-MM.' }) period: string;
  @IsString() @MaxLength(200) narration: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => JournalLineDto) lines: JournalLineDto[];
}
