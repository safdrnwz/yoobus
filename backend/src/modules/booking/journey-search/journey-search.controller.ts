import { Controller, Get, Query } from '@nestjs/common';
import { JourneySearchService } from './journey-search.service';
import { JourneySearchDto } from './dto/journey-search.dto';
import { Public } from '../../../common/decorators/public.decorator';

/** Public connecting-journey search (direct + one-connection across operators). */
@Controller('booking/journeys')
export class JourneySearchController {
  constructor(private readonly journeys: JourneySearchService) {}

  @Public() @Get('search')
  search(@Query() dto: JourneySearchDto) {
    return this.journeys.search(dto.fromStopId, dto.toStopId, dto.date, dto.minLayover ?? 20, dto.maxLayover ?? 360, dto.maxConnections ?? 1, dto.operatorId ?? null);
  }
}
