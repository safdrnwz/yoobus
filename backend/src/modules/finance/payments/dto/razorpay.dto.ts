import { IsString, IsUUID, MaxLength } from 'class-validator';
export class CreateOrderDto { @IsUUID() bookingId: string; }
export class VerifyPaymentDto {
  @IsString() @MaxLength(60) razorpay_order_id: string;
  @IsString() @MaxLength(60) razorpay_payment_id: string;
  @IsString() @MaxLength(256) razorpay_signature: string;
}
