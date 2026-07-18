import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../customer/users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { Complaint, LostFoundCase, PassengerFlag, SupportTicket } from './entities/support.entities';
import { SupportCrmService } from './support-crm.service';
import { SupportCrmController } from './support-crm.controller';

@Module({
  imports: [UsersModule, EmailModule, TypeOrmModule.forFeature([SupportTicket, Complaint, LostFoundCase, PassengerFlag])],
  controllers: [SupportCrmController],
  providers: [SupportCrmService],
  exports: [SupportCrmService],
})
export class SupportCrmModule {}
