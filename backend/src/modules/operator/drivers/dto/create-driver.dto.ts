import { IsOptional, IsString, Matches } from 'class-validator';
export class CreateDriverDto {
  @IsString() fullName: string;
  @Matches(/^[0-9]{10}$/, { message: 'phone must be 10 digits' }) phone: string;
  @IsString() licenseNumber: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) licenseExpiry?: string;
}
