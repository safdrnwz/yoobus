import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { OperatorLead } from './entities/operator-lead.entity';
import { OperatorsService } from './operators.service';
import { OperatorsController } from './operators.controller';
import { UsersModule } from '../../customer/users/users.module';
import { BillingModule } from '../../finance/billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Operator, OperatorLead]), UsersModule, BillingModule],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
