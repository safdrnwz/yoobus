import { IsNumber, IsOptional, IsString, Length } from 'class-validator';
export class CreateStopDto {
  @IsString() name: string;
  @IsString() city: string;
  @IsOptional() @IsString() state?: string;
  @IsString() @Length(2, 10) code: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
