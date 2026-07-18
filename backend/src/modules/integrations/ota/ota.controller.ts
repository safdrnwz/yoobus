import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OtaService } from './ota.service';
import { OtaApiKeyGuard } from './ota-apikey.guard';
import { OtaBlockDto, OtaCancelDto, OtaConfirmDto, OtaSearchDto } from './dto/ota.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { OtaPartner } from './ota-partner.decorator';

/** Inbound OTA distribution API (redBus, AbhiBus, MakeMyTrip, …). Auth: `x-api-key` header. */
@Public()
@UseGuards(OtaApiKeyGuard)
@Controller('ota/v1')
export class OtaController {
  constructor(private readonly ota: OtaService) {}

  @Post('search') search(@Body() dto: OtaSearchDto) { return this.ota.search(dto); }
  @Get('trips/:id/seat-map') seatMap(@Param('id') id: string, @Query('boardingStopId') b: string, @Query('droppingStopId') d: string) { return this.ota.seatMap(id, b, d); }
  @Post('block') block(@Body() dto: OtaBlockDto) { return this.ota.block(dto); }
  @Post('confirm') confirm(@OtaPartner() partnerId: string, @Body() dto: OtaConfirmDto) { return this.ota.confirm(partnerId, dto); }
  @Get('status/:pnr') status(@Param('pnr') pnr: string) { return this.ota.status(pnr); }
  @Post('cancel') cancel(@Body() dto: OtaCancelDto) { return this.ota.cancel(dto.pnr); }
}
