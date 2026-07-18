import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SupportCrmService } from './support-crm.service';
import { BlacklistDto, CreateComplaintDto, CreateTicketDto, LostFoundDto } from './dto/support.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator/support CRM endpoints. */
/**
 * Two desks work here, and they are not the same desk.
 *
 *   SUPPORT / OPERATOR_ADMIN  — an operator's own people. Scoped to their own operator.
 *   PLATFORM_SUPPORT          — Yoo Bus's desk. Belongs to NO operator, so it must say
 *                               which one it is looking at: ?operatorId=<id>.
 *
 * resolveOperatorScope() enforces exactly that. It also replaces `resolveOperatorScope(u, scopeOp)`, which
 * was a 500 waiting to happen the moment a platform role reached one of these handlers.
 */
@Roles(Role.OPERATOR_ADMIN, Role.SUPPORT, Role.PLATFORM_SUPPORT)
@Controller('operator/support')
export class SupportCrmController {
  constructor(private readonly support: SupportCrmService) {}

  // Tickets
  @RequirePermission('CREATE_SUPPORT_TICKET') @Post('tickets')
  createTicket(@CurrentUser() u: JwtUser, @Body() dto: CreateTicketDto, @Query('operatorId') scopeOp?: string) { return this.support.createTicket(resolveOperatorScope(u, scopeOp), u.id, dto); }
  @RequirePermission('VIEW_SUPPORT_TICKETS') @Get('tickets')
  listTickets(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.support.listTickets(resolveOperatorScope(u, scopeOp)); }
  @RequirePermission('ASSIGN_SUPPORT_TICKET') @Patch('tickets/:id/assign')
  assign(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body('assigneeId') assigneeId: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionTicket(resolveOperatorScope(u, scopeOp), id, 'ASSIGNED', assigneeId); }
  @RequirePermission('ASSIGN_SUPPORT_TICKET') @Patch('tickets/:id/escalate')
  escalate(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionTicket(resolveOperatorScope(u, scopeOp), id, 'ESCALATED'); }
  @RequirePermission('CLOSE_SUPPORT_TICKET') @Patch('tickets/:id/resolve')
  resolve(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionTicket(resolveOperatorScope(u, scopeOp), id, 'RESOLVED'); }
  @RequirePermission('CLOSE_SUPPORT_TICKET') @Patch('tickets/:id/close')
  close(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionTicket(resolveOperatorScope(u, scopeOp), id, 'CLOSED'); }

  // Complaints
  @RequirePermission('CREATE_COMPLAINT') @Post('complaints')
  createComplaint(@CurrentUser() u: JwtUser, @Body() dto: CreateComplaintDto, @Query('operatorId') scopeOp?: string) { return this.support.createComplaint(resolveOperatorScope(u, scopeOp), dto); }
  @RequirePermission('VIEW_SUPPORT_DASHBOARD') @Get('complaints')
  listComplaints(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.support.listComplaints(resolveOperatorScope(u, scopeOp)); }
  @RequirePermission('RESOLVE_COMPLAINT') @Patch('complaints/:id/resolve')
  resolveComplaint(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionComplaint(resolveOperatorScope(u, scopeOp), id, 'RESOLVED'); }
  @RequirePermission('RESOLVE_COMPLAINT') @Patch('complaints/:id/reopen')
  reopenComplaint(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.transitionComplaint(resolveOperatorScope(u, scopeOp), id, 'OPEN'); }

  // Lost & found
  @RequirePermission('MANAGE_LOST_FOUND') @Post('lost-found')
  createLostFound(@CurrentUser() u: JwtUser, @Body() dto: LostFoundDto, @Query('operatorId') scopeOp?: string) { return this.support.createLostFound(resolveOperatorScope(u, scopeOp), dto); }
  @RequirePermission('MANAGE_LOST_FOUND') @Get('lost-found')
  listLostFound(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.support.listLostFound(resolveOperatorScope(u, scopeOp)); }
  @RequirePermission('MANAGE_LOST_FOUND') @Patch('lost-found/:id/close')
  closeLostFound(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('operatorId') scopeOp?: string) { return this.support.closeLostFound(resolveOperatorScope(u, scopeOp), id); }

  // Passenger blacklist
  @RequirePermission('BLACKLIST_PASSENGER') @Post('blacklist')
  blacklist(@CurrentUser() u: JwtUser, @Body() dto: BlacklistDto, @Query('operatorId') scopeOp?: string) { return this.support.setBlacklist(resolveOperatorScope(u, scopeOp), dto); }
  @RequirePermission('VIEW_CUSTOMER_TIMELINE') @Get('blacklist')
  listBlacklist(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.support.listBlacklist(resolveOperatorScope(u, scopeOp)); }
}
