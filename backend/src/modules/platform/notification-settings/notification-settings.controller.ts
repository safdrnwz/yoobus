import { Body, Controller, Get, Put } from '@nestjs/common';
import { NotificationPolicyService } from './notification-policy.service';
import { SetOperatorPrefDto } from './dto/notification-settings.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller()
export class NotificationSettingsController {
  constructor(private readonly policy: NotificationPolicyService) {}

  // Operator: control which optional notifications go to customers/staff, per channel.
  @Roles(Role.OPERATOR_ADMIN) @Get('operator/notifications')
  myPrefs(@CurrentUser() u: JwtUser) { return this.policy.operatorPrefs(u.operatorId!); }

  @Roles(Role.OPERATOR_ADMIN) @Put('operator/notifications')
  setPref(@CurrentUser() u: JwtUser, @Body() dto: SetOperatorPrefDto) {
    return this.policy.setOperatorPref(u.operatorId!, dto.notificationKey, dto.channel, dto.enabled);
  }
}
