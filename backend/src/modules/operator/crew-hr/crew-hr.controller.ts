import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CrewHrService } from './crew-hr.service';
import { CheckInDto, CreateEmployeeDto, CreateShiftDto, LeaveDto } from './dto/crew.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped crew & HR endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/crew')
export class CrewHrController {
  constructor(private readonly crew: CrewHrService) {}

  @RequirePermission('CREATE_EMPLOYEE') @Post('employees')
  createEmployee(@CurrentUser() u: JwtUser, @Body() dto: CreateEmployeeDto) { return this.crew.createEmployee(u.operatorId!, dto); }
  @RequirePermission('CREATE_EMPLOYEE') @Get('employees')
  listEmployees(@CurrentUser() u: JwtUser) { return this.crew.listEmployees(u.operatorId!); }

  @RequirePermission('MANAGE_SHIFT') @Post('shifts')
  createShift(@CurrentUser() u: JwtUser, @Body() dto: CreateShiftDto) { return this.crew.createShift(u.operatorId!, dto); }
  @RequirePermission('MANAGE_DUTY_ROSTER') @Get('shifts')
  listShifts(@CurrentUser() u: JwtUser) { return this.crew.listShifts(u.operatorId!); }

  @RequirePermission('MANAGE_ATTENDANCE') @Post('attendance')
  recordAttendance(@CurrentUser() u: JwtUser, @Body() dto: CheckInDto) { return this.crew.recordAttendance(u.operatorId!, dto); }
  @RequirePermission('MANAGE_ATTENDANCE') @Get('attendance')
  listAttendance(@CurrentUser() u: JwtUser) { return this.crew.listAttendance(u.operatorId!); }

  @RequirePermission('APPROVE_LEAVE') @Post('leave')
  requestLeave(@CurrentUser() u: JwtUser, @Body() dto: LeaveDto) { return this.crew.requestLeave(u.operatorId!, dto); }
  @RequirePermission('APPROVE_LEAVE') @Get('leave')
  listLeave(@CurrentUser() u: JwtUser) { return this.crew.listLeave(u.operatorId!); }
  @RequirePermission('APPROVE_LEAVE') @Patch('leave/:id/approve')
  approveLeave(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.crew.decideLeave(u.operatorId!, id, true); }
  @RequirePermission('APPROVE_LEAVE') @Patch('leave/:id/reject')
  rejectLeave(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.crew.decideLeave(u.operatorId!, id, false); }
}
