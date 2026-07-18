import { Module, OnModuleInit } from '@nestjs/common';
import { RbacService } from '../../../common/rbac/rbac.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../customer/users/entities/user.entity';
import { CustomRole } from './entities/custom-role.entity';
import { CustomRolesController } from './custom-roles.controller';
import { CustomRolesService } from './custom-roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomRole, User])],
  controllers: [CustomRolesController],
  providers: [CustomRolesService],
  exports: [CustomRolesService],
})
export class CustomRolesModule implements OnModuleInit {
  constructor(
    private readonly rbac: RbacService,
    private readonly customRoles: CustomRolesService,
  ) {}

  /** Hand RbacService the custom-role resolver at boot (registered, not injected, to avoid a cycle). */
  onModuleInit(): void {
    this.rbac.registerCustomRoles(this.customRoles);
  }
}
