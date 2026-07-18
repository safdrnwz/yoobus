import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RbacModule } from './common/rbac/rbac.module';
import { PermissionsGuard } from './common/rbac/permissions.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { BookingModule } from './modules/booking/booking.module';
import { CustomerModule } from './modules/customer/customer.module';
import { FinanceDomainModule } from './modules/finance/finance.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { OperatorModule } from './modules/operator/operator.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SharedModule } from './modules/shared/shared.module';
import { SystemModule } from './modules/system/system.module';

import { NotificationsModule } from './common/notifications/notifications.module';
import { AuditInterceptor } from './modules/platform/audit/audit.interceptor';
import { MaintenanceGuard } from './modules/operator/maintenance/maintenance.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    // Rate limiting (Rule 064): 100 requests / 60s per IP by default.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RbacModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    BookingModule,
    CustomerModule,
    FinanceDomainModule,
    IntegrationsModule,
    OperatorModule,
    PlatformModule,
    SharedModule,
    SystemModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        // Query/param values arrive as strings. Without this, `page: number` is really "2".
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
