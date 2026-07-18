import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { RegisterChannelDto } from './dto/register-channel.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Roles(Role.OPERATOR_ADMIN) @Post()
  register(@CurrentUser() u: JwtUser, @Body() dto: RegisterChannelDto) {
    return this.channels.register(u.operatorId!, dto);
  }

  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get()
  list(@CurrentUser() u: JwtUser) {
    return this.channels.listByOperator(u.operatorId!);
  }

  // Partner/OTA inventory sync: sold seats across all channels.
  @Roles(Role.OPERATOR_ADMIN) @Get('inventory/:tripId')
  inventory(@Param('tripId') tripId: string) {
    return this.channels.inventory(tripId);
  }
}
