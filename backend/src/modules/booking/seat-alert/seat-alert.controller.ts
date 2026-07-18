import { Body, Controller, Param, Post } from '@nestjs/common';
import { SeatAlertService } from './seat-alert.service';
import { CreateSeatAlertDto } from './dto/seat-alert.dto';
import { Public } from '../../../common/decorators/public.decorator';

/** Guest-friendly: shoppers can ask to be alerted when a full trip frees a seat. */
@Controller('trips')
export class SeatAlertController {
  constructor(private readonly seatAlert: SeatAlertService) {}

  @Public() @Post(':id/seat-alert')
  watch(@Param('id') tripId: string, @Body() dto: CreateSeatAlertDto) {
    return this.seatAlert.watch(tripId, dto);
  }
}
