import { Body, Controller, Get, Post } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { RedeemPointsDto, RedeemReferralDto } from './dto/loyalty.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Roles(Role.CUSTOMER)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get() summary(@CurrentUser('id') userId: string) { return this.loyalty.summary(userId); }
  @Post('referral/redeem') redeemReferral(@CurrentUser('id') userId: string, @Body() dto: RedeemReferralDto) { return this.loyalty.redeemReferral(userId, dto.code); }
  @Post('points/redeem') redeemPoints(@CurrentUser('id') userId: string, @Body() dto: RedeemPointsDto) { return this.loyalty.redeemPoints(userId, dto.points); }
}
