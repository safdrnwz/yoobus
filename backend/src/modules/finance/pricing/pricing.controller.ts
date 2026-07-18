import { Controller, Get, Param } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Public price preview so storefronts/OTAs can show live fares. */
  @Public()
  @Get('trips/:id')
  preview(@Param('id') id: string) {
    return this.pricing.previewForTrip(id);
  }
}
