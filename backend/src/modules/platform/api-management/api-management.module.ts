import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiPartner } from './entities/api-partner.entity';
import { ApiKey } from './entities/api-key.entity';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { ApiVersion } from './entities/api-version.entity';
import { ApiManagementService } from './api-management.service';
import { ApiManagementController } from './api-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApiPartner, ApiKey, Webhook, WebhookDelivery, ApiVersion])],
  controllers: [ApiManagementController],
  providers: [ApiManagementService],
  exports: [ApiManagementService],
})
export class ApiManagementModule {}
