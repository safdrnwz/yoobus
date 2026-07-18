import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(Role.OPERATOR_ADMIN, Role.SUPERADMIN) @Get()
  list(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) {
    return this.audit.list(resolveOperatorScope(u, scopeOp));
  }
}
