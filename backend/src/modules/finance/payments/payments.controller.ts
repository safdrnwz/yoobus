import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/razorpay.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // STEP 1: create order (frontend then opens Razorpay checkout with this orderId + keyId)
  @Roles(Role.CUSTOMER) @Post('razorpay/order')
  createOrder(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.payments.createOrder(userId, dto.bookingId);
  }

  // STEP 3: verify signature; booking is confirmed only if it matches
  @Roles(Role.CUSTOMER) @Post('razorpay/verify')
  verify(@CurrentUser('id') userId: string, @Body() dto: VerifyPaymentDto) {
    return this.payments.verifyPayment(userId, dto);
  }
}
