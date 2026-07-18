import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from '../email/email-log.entity';
import { NotificationsQueryService } from './notifications-query.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  controllers: [NotificationsController],
  providers: [NotificationsQueryService],
  exports: [NotificationsQueryService],
})
export class NotificationsQueryModule {}
