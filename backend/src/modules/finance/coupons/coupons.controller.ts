import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { isPlatformRole, Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  // Operator admins create operator-scoped coupons; superadmin can create platform-wide ones.
  @Roles(Role.OPERATOR_ADMIN, Role.SUPERADMIN) @RequirePermission('MANAGE_COUPON') @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateCouponDto) {
    // A platform coupon (operatorId = null) is created by platform staff; an operator's own
    // coupon is scoped to that operator. Never dereference operatorId! blindly — a platform
    // role has none, and `null!` is how you get a 500.
    const scope = isPlatformRole(u.role as Role) ? null : resolveOperatorScope(u, undefined);
    return this.coupons.create(scope, dto);
  }

  @Roles(Role.OPERATOR_ADMIN, Role.SUPERADMIN) @RequirePermission('VIEW_COUPON') @Get()
  list(@CurrentUser() u: JwtUser) { return this.coupons.list(u.operatorId); }

  // Customer checks a code before paying.
  @Roles(Role.CUSTOMER) @Post('validate')
  validate(@CurrentUser() u: JwtUser, @Body() dto: ValidateCouponDto) {
    return this.coupons.quote(dto.code, dto.fare, u.id);
  }
}
