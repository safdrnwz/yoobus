import { IsInt, IsString, MaxLength, Min } from 'class-validator';
export class RedeemReferralDto { @IsString() @MaxLength(12) code: string; }
export class RedeemPointsDto { @IsInt() @Min(1) points: number; }
