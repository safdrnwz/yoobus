import { Body, Controller, Get, Post } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { TopupDto, WalletPayDto } from './dto/wallet.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Roles(Role.CUSTOMER)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get() summary(@CurrentUser('id') userId: string) { return this.wallet.summary(userId); }
  @Post('topup') topup(@CurrentUser('id') userId: string, @Body() dto: TopupDto) { return this.wallet.topup(userId, dto.amount); }
  @Post('pay') pay(@CurrentUser('id') userId: string, @Body() dto: WalletPayDto) { return this.wallet.payBooking(userId, dto.bookingId); }
}
