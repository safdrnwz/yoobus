import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub, HubRoute } from './entities/hub.entities';
import { Route } from '../routes/entities/route.entity';
import { HubService } from './hub.service';
import { HubController } from './hub.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hub, HubRoute, Route])],
  controllers: [HubController],
  providers: [HubService],
  exports: [HubService],
})
export class HubModule {}
