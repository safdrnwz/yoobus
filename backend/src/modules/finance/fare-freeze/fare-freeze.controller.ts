import { Body, Controller, Param, Post } from '@nestjs/common';
import { FareFreezeService } from './fare-freeze.service';
import { FreezeFareDto } from './dto/fare-freeze.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('trips')
export class FareFreezeController {
  constructor(private readonly fareFreeze: FareFreezeService) {}

  @Roles(Role.CUSTOMER) @Post(':id/fare-freeze')
  freeze(@CurrentUser('id') userId: string, @Param('id') tripId: string, @Body() dto: FreezeFareDto) {
    return this.fareFreeze.freeze(userId, tripId, dto);
  }
}
