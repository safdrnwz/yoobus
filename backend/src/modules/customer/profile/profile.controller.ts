import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { SavePassengerDto, UpdateProfileDto } from './dto/profile.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/** Customer self-service surface (`/me`). */
@Roles(Role.CUSTOMER)
@Controller('me')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get() get(@CurrentUser('id') userId: string) { return this.profile.getProfile(userId); }
  @Get('profile-completion') profileCompletion(@CurrentUser('id') userId: string) { return this.profile.profileCompletion(userId); }
  @Patch() update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) { return this.profile.updateProfile(userId, dto); }
  @Delete() deactivate(@CurrentUser('id') userId: string) { return this.profile.deactivate(userId); }

  // Unified home: profile + wallet + loyalty + recent bookings in one call.
  @Get('dashboard') dashboard(@CurrentUser('id') userId: string) { return this.profile.dashboard(userId); }
  @Get('bookings') bookings(@CurrentUser('id') userId: string, @Query('limit') limit?: string) { return this.profile.bookingHistory(userId, limit ? parseInt(limit, 10) : 50); }

  // Saved passengers.
  @Get('passengers') listPassengers(@CurrentUser('id') userId: string) { return this.profile.listPassengers(userId); }
  @Post('passengers') addPassenger(@CurrentUser('id') userId: string, @Body() dto: SavePassengerDto) { return this.profile.addPassenger(userId, dto); }
  @Delete('passengers/:id') removePassenger(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.profile.removePassenger(userId, id); }
}
