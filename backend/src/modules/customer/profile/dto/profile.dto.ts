import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) fullName?: string;
  @IsOptional() @Matches(/^[0-9]{10}$/, { message: 'phone must be 10 digits' }) phone?: string;
  // Requirement 4 — profile-completion fields.
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' }) dateOfBirth?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
}
export class SavePassengerDto {
  @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsIn(['M', 'F', 'OTHER']) gender?: string;
  @IsOptional() @IsString() @MaxLength(40) idType?: string;
  @IsOptional() @IsString() @MaxLength(60) idNumber?: string;
}
