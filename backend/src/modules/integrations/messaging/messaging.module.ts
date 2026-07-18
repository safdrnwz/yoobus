import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingUsage } from './entities/messaging-usage.entity';
import { MessagingService } from './messaging.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessagingUsage]), ConfigModule],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
