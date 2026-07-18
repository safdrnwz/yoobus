import { Controller, Get, Param } from '@nestjs/common';
import { GpsService } from './gps.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Passenger live tracking. The token in the URL IS the capability (sent via WhatsApp/email),
 * so this is public — but it only ever returns that one booking's tracking, scoped by the token.
 */
@Public()
@Controller('track')
export class GpsTrackingController {
  constructor(private readonly gps: GpsService) {}

  @Get(':token')
  track(@Param('token') token: string) { return this.gps.getTracking(token); }
}
