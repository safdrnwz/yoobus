import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** Partial update. Replaces `@Body() patch: any`, which skipped validation completely. */
export class UpdateOperatorDto {
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' }) mobile?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) commissionRate?: number; // fraction 0..1
  @IsOptional() @IsBoolean() isActive?: boolean;
  // Per-operator billing config (set by SuperAdmin; different per operator).
  @IsOptional() @IsNumber() @Min(0) oneTimePlatformFee?: number;
  @IsOptional() @IsNumber() @Min(0) smsCharge?: number;
  @IsOptional() @IsNumber() @Min(0) whatsappCharge?: number;
  @IsOptional() @IsNumber() @Min(0) emailCharge?: number;
  @IsOptional() @IsObject() extraCharges?: Record<string, number>;
}

import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Platform administration — SuperAdmin only, cross-operator. */
@Roles(Role.SUPERADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('operators/:id/buses') buses(@Param('id') id: string) { return this.admin.busesOf(id); }
  @Get('operators/:id/drivers') drivers(@Param('id') id: string) { return this.admin.driversOf(id); }
  @Get('operators/:id/routes') routes(@Param('id') id: string) { return this.admin.routesOf(id); }
  @Get('operators/:id/trips') trips(@Param('id') id: string) { return this.admin.tripsOf(id); }
  @Get('operators/:id/bookings') bookings(@Param('id') id: string) { return this.admin.bookingsOf(id); }
  @Get('operators/:id/billing') billing(@Param('id') id: string) { return this.admin.billingOf(id); }
  @Get('operators/:id/records-export') records(@Param('id') id: string) { return this.admin.recordsExport(id); }

  @Put('operators/:id') update(@Param('id') id: string, @Body() patch: UpdateOperatorDto) { return this.admin.updateOperator(id, patch); }

  @Delete('operators/:id') delOperator(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.admin.softDeleteOperator(u.role, id); }
  @Delete('buses/:id') delBus(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.admin.softDeleteBus(u.role, id); }
  @Delete('drivers/:id') delDriver(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.admin.softDeleteDriver(u.role, id); }
  @Delete('routes/:id') delRoute(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.admin.softDeleteRoute(u.role, id); }

  // ALL logs across every operator + all Yoo Bus platform roles (filters + pagination).
  @Get('logs')
  logs(
    @Query('operatorId') operatorId?: string,
    @Query('userId') userId?: string,
    @Query('role') role?: string,
    @Query('method') method?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const filter: any = {};
    if (operatorId !== undefined) filter.operatorId = operatorId === 'platform' ? null : operatorId;
    if (userId) filter.userId = userId;
    if (role) filter.role = role;
    if (method) filter.method = method;
    if (action) filter.action = action;
    if (from) filter.from = from;
    if (to) filter.to = to;
    return this.audit.queryAll(filter, Number(page) || 1, Number(pageSize) || 50);
  }
}
