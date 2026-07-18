import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { BulkSetSettingsDto } from './dto/config.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/**
 * Global look-and-feel of every Yoo Bus surface.
 *
 * READ is public on purpose: the sign-in screen has to paint the operator's brand before
 * anyone has a token, so the theme cannot sit behind auth. Nothing here is sensitive —
 * it is colours, fonts and spacing.
 *
 * WRITE is SuperAdmin-only, enforced twice: the role gate below and the
 * CONFIGURE_PLATFORM_SETTINGS permission, which the catalog grants to SUPERADMIN alone.
 *
 * This controller is deliberately separate from PlatformConfigController, which carries a
 * class-level @Roles(SUPERADMIN); a public route cannot live under that class gate.
 */
@Controller('appearance')
export class AppearanceController {
  constructor(private readonly config: PlatformConfigService) {}

  /** The theme in force: platform defaults merged with whatever the SuperAdmin saved. */
  @Public()
  @Get()
  get() {
    return this.config.effectiveNamespace('APPEARANCE');
  }

  /** Replace the theme in one atomic, versioned change. SuperAdmin only. */
  @Roles(Role.SUPERADMIN)
  @RequirePermission('CONFIGURE_PLATFORM_SETTINGS')
  @Put()
  update(@CurrentUser() user: JwtUser, @Body() dto: BulkSetSettingsDto) {
    return this.config.setSettingsBulk('APPEARANCE', dto, user.id);
  }

  /** Discard every customisation and fall back to the platform defaults. SuperAdmin only. */
  @Roles(Role.SUPERADMIN)
  @RequirePermission('CONFIGURE_PLATFORM_SETTINGS')
  @Post('reset')
  reset(@CurrentUser() user: JwtUser) {
    return this.config.resetNamespace('APPEARANCE', user.id);
  }

  /** Every saved revision of the theme, newest first — the source for restore. */
  @Roles(Role.SUPERADMIN)
  @RequirePermission('VIEW_CONFIG_VERSIONS')
  @Get('versions')
  versions() {
    return this.config.listVersions('APPEARANCE');
  }
}
