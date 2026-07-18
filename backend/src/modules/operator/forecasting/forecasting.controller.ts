import { Body, Controller, Get, Post } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { CreateForecastDto } from './dto/forecast.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator demand-forecasting endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/forecasting')
export class ForecastingController {
  constructor(private readonly forecasting: ForecastingService) {}

  @RequirePermission('GENERATE_FORECAST') @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateForecastDto) { return this.forecasting.create(u.operatorId!, dto); }
  @RequirePermission('VIEW_FORECAST_DASHBOARD') @Get()
  list(@CurrentUser() u: JwtUser) { return this.forecasting.list(u.operatorId!); }
}
