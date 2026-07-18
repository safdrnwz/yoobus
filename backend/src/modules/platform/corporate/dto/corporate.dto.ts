import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateCorporateDto {
  @IsString() @MaxLength(160) companyName: string;
  @IsEmail() adminEmail: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
}
export class AddEmployeeDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(120) fullName: string;
}
