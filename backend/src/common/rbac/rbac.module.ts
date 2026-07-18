import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionOverride } from './permission-override.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { PermissionsGuard } from './permissions.guard';

/** Global RBAC module: single-source catalog, effective-permission resolution, guard. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PermissionOverride])],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
