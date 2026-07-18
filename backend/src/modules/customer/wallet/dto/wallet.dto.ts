import { IsNumber, IsUUID, Min } from 'class-validator';
export class TopupDto { @IsNumber() @Min(1) amount: number; }
export class WalletPayDto { @IsUUID() bookingId: string; }
