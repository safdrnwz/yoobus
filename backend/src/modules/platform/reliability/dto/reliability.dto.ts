import { IsString, MaxLength } from 'class-validator';

export class RegisterJobDto {
  @IsString() @MaxLength(80) name: string;
}

export class LogDeploymentDto {
  @IsString() @MaxLength(40) version: string;
}
