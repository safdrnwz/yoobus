import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto , AssignDriverDto} from './dto/create-trip.dto';
import { SearchTripDto } from './dto/search-trip.dto';
import { SeatAvailabilityDto } from './dto/seat-availability.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Roles(Role.OPERATOR_ADMIN) @Post(':id/assign-driver')
  assignDriver(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() body: AssignDriverDto) {
    return this.trips.assignDriver(u.operatorId!, id, body.driverId);
  }

  @Roles(Role.OPERATOR_ADMIN) @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateTripDto) {
    return this.trips.create(u.operatorId!, dto);
  }

  // Public guest-checkout search and seat availability.
  @Public() @Get('search')
  search(@Query() dto: SearchTripDto) {
    return this.trips.search(dto.fromStopId, dto.toStopId, dto.date, dto.operatorId ?? null);
  }

  @Public() @Get(':id/seat-map')
  seatMap(@Param('id') id: string, @Query() dto: SeatAvailabilityDto) {
    return this.trips.seatMap(id, dto.boardingStopId, dto.droppingStopId);
  }

  @Public() @Get(':id/seats')
  seats(@Param('id') id: string, @Query() dto: SeatAvailabilityDto) {
    return this.trips.getSeatAvailability(id, dto.boardingStopId, dto.droppingStopId);
  }

  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Patch(':id/complete')
  complete(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.trips.markCompleted(id, u.operatorId!);
  }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.trips.cancel(u.operatorId!, id);
  }
}
