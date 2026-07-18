import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelCard, FuelTransaction } from './entities/fuel.entities';
import { FuelService } from './fuel.service';
import { FuelController } from './fuel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FuelTransaction, FuelCard])],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
