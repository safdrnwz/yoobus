import { AppException } from '../../../common/errors/app-exception';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, HttpStatus } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { BulkSetSettingsDto, SetSettingDto, OperatorOverrideDto, UpsertFlagDto } from './dto/config.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { SETTING_NAMESPACES, SettingNamespace } from '../../../common/logic/platform-config.util';

/**
 * A namespace that does not exist is a bad request, not an empty success.
 *
 * `GET /effective/NOT_A_NAMESPACE` used to answer `200 {}` — indistinguishable from a real
 * namespace that happens to have no overrides. A typo in a URL looked like a working call
 * returning nothing, which is the most expensive kind of bug to chase.
 */
function assertNamespace(namespace: string): SettingNamespace {
  if (!SETTING_NAMESPACES.includes(namespace as SettingNamespace)) {
    throw new AppException(
      'UNKNOWN_NAMESPACE',
      `Unknown settings namespace '${namespace}'. Valid: ${SETTING_NAMESPACES.join(', ')}.`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return namespace as SettingNamespace;
}

/** SuperAdmin-only platform configuration endpoints. */
@Roles(Role.SUPERADMIN)

@Controller('platform-config')
export class PlatformConfigController {
  constructor(private readonly config: PlatformConfigService) {}

  // Settings
  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('settings') all() {
    return this.config.getAllSettings();
  }
  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('settings/:namespace') byNamespace(@Param('namespace') namespace: string) {
    return this.config.getSettings(assertNamespace(namespace));
  }
  @RequirePermission('CONFIGURE_PLATFORM_SETTINGS') @Post('settings') set(@CurrentUser() user: JwtUser, @Body() dto: SetSettingDto) {
    return this.config.setSetting(dto, user.id);
  }

  /** Save a whole namespace at once as a single versioned change. */
  @RequirePermission('CONFIGURE_PLATFORM_SETTINGS') @Put('settings/:namespace') setBulk(
    @CurrentUser() user: JwtUser,
    @Param('namespace') namespace: string,
    @Body() dto: BulkSetSettingsDto,
  ) {
    return this.config.setSettingsBulk(assertNamespace(namespace), dto, user.id);
  }

  /** Discard every override in a namespace and fall back to the platform defaults. */
  @RequirePermission('CONFIGURE_PLATFORM_SETTINGS') @Post('settings/:namespace/reset') resetNamespace(
    @CurrentUser() user: JwtUser,
    @Param('namespace') namespace: string,
  ) {
    return this.config.resetNamespace(assertNamespace(namespace), user.id);
  }

  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('effective/:namespace') effectiveNamespace(@Param('namespace') namespace: string) {
    return this.config.effectiveNamespace(assertNamespace(namespace));
  }
  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('effective/:namespace/:key') effectiveValue(@Param('namespace') namespace: string, @Param('key') key: string) {
    return this.config.effective(assertNamespace(namespace), key);
  }

  // Feature flags
  @RequirePermission('CONFIGURE_FEATURE_FLAGS') @Get('flags') flags() {
    return this.config.listFlags();
  }
  @RequirePermission('CONFIGURE_FEATURE_FLAGS') @Post('flags') upsertFlag(@Body() dto: UpsertFlagDto) {
    return this.config.upsertFlag(dto);
  }
  @RequirePermission('CONFIGURE_FEATURE_FLAGS') @Post('flags/:key/override') override(@Param('key') key: string, @Body() dto: OperatorOverrideDto) {
    return this.config.setOperatorOverride(key, dto);
  }
  @RequirePermission('CONFIGURE_FEATURE_FLAGS') @Delete('flags/:key/override/:operatorId') clearOverride(@Param('key') key: string, @Param('operatorId') operatorId: string) {
    return this.config.clearOperatorOverride(key, operatorId);
  }
  @RequirePermission('CONFIGURE_FEATURE_FLAGS') @Get('flags/:key/evaluate') evaluate(@Param('key') key: string, @Query('operatorId') operatorId?: string) {
    return this.config.evaluate(key, operatorId ?? null);
  }

  // Version history
  // ORDER MATTERS. Nest matches routes in declaration order, so `versions/:namespace`
  // declared first would swallow `versions/compare` — the literal path must come first,
  // or `?a=&b=` compare requests get handled as a namespace called "compare".
  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('versions/compare') compare(@Query('a') a: string, @Query('b') b: string) {
    return this.config.compareVersions(a, b);
  }
  @RequirePermission('VIEW_CONFIG_VERSIONS') @Get('versions/:namespace') versions(@Param('namespace') namespace: string) {
    return this.config.listVersions(assertNamespace(namespace));
  }
  @RequirePermission('RESTORE_CONFIG_VERSION') @Post('versions/:id/restore') restore(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.config.restoreVersion(id, user.id);
  }
}
