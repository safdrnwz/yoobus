import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @MaxLength(120) fullName: string;
  @IsString() @MaxLength(40) designation: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}
export class CreateShiftDto {
  @IsString() @MaxLength(60) name: string;
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;
  @IsOptional() @IsUUID() employeeId?: string;
}
export class CheckInDto {
  @IsUUID() employeeId: string;
  @IsDateString() shiftStart: string;
  @IsOptional() @IsDateString() checkIn?: string;
}
export class LeaveDto {
  @IsUUID() employeeId: string;
  @IsDateString() fromAt: string;
  @IsDateString() toAt: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
