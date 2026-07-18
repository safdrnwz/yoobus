import { Module } from '@nestjs/common';
import { JourneySearchService } from './journey-search.service';
import { JourneySearchController } from './journey-search.controller';
import { TripsModule } from '../../operator/trips/trips.module';

@Module({
  imports: [TripsModule],
  controllers: [JourneySearchController],
  providers: [JourneySearchService],
  exports: [JourneySearchService],
})
export class JourneySearchModule {}
