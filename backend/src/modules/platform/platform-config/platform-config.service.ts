import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { ConfigVersion } from './entities/config-version.entity';
import { BulkSetSettingsDto, SetSettingDto, OperatorOverrideDto, UpsertFlagDto } from './dto/config.dto';
import { AppException } from '../../../common/errors/app-exception';
import { diffConfig, evaluateFlag, SettingNamespace, validateSetting } from '../../../common/logic/platform-config.util';
import { PLATFORM_DEFAULTS, platformDefault } from '../../../common/config/platform-defaults';

/**
 * SuperAdmin platform configuration: global settings, feature flags, and config version
 * history. Maintenance scheduling and the audit trail are intentionally NOT duplicated
 * here — they live in MaintenanceModule and AuditModule respectively.
 */
@Injectable()
export class PlatformConfigService {
  constructor(
    @InjectRepository(PlatformSetting) private readonly settingRepo: Repository<PlatformSetting>,
    @InjectRepository(FeatureFlag) private readonly flagRepo: Repository<FeatureFlag>,
    @InjectRepository(ConfigVersion) private readonly versionRepo: Repository<ConfigVersion>,
  ) {}

  // ---- Settings ----
  async getSettings(namespace: SettingNamespace): Promise<Record<string, unknown>> {
    const rows = await this.settingRepo.find({ where: { namespace } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getAllSettings(): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.settingRepo.find();
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      grouped[r.namespace] = grouped[r.namespace] ?? {};
      grouped[r.namespace][r.key] = r.value;
    }
    return grouped;
  }

  /** Effective value = DB override if present, otherwise the platform default (single source). */
  async effective(namespace: SettingNamespace, key: string): Promise<unknown> {
    const row = await this.settingRepo.findOne({ where: { namespace, key } });
    if (row) return row.value;
    return platformDefault(namespace, key);
  }

  /** Effective namespace = platform defaults merged with any saved overrides. */
  async effectiveNamespace(namespace: SettingNamespace): Promise<Record<string, unknown>> {
    const defaults = (PLATFORM_DEFAULTS as Record<string, Record<string, unknown>>)[namespace] ?? {};
    const overrides = await this.getSettings(namespace);
    return { ...defaults, ...overrides };
  }

  async setSetting(dto: SetSettingDto, userId?: string): Promise<PlatformSetting> {
    const validation = validateSetting(dto.namespace, dto.key, dto.value);
    if (!validation.ok) throw new AppException(validation.code ?? 'CONFIG_INVALID', validation.message ?? 'Invalid setting.', HttpStatus.BAD_REQUEST);

    // Snapshot the namespace before changing it so the change can be compared or restored.
    const before = await this.getSettings(dto.namespace as SettingNamespace);
    await this.versionRepo.save(this.versionRepo.create({ namespace: dto.namespace as SettingNamespace, snapshot: before, createdBy: userId ?? null }));

    let setting = await this.settingRepo.findOne({ where: { namespace: dto.namespace as SettingNamespace, key: dto.key } });
    if (setting) {
      setting.value = dto.value;
      setting.updatedBy = userId ?? null;
    } else {
      setting = this.settingRepo.create({ namespace: dto.namespace as SettingNamespace, key: dto.key, value: dto.value, updatedBy: userId ?? null });
    }
    return this.settingRepo.save(setting);
  }

  /**
   * Saves many keys in ONE versioned change. The Global Settings screen edits a whole
   * theme at once; writing each key individually would create a version row per key and
   * could leave the UI half-themed if one key failed. Every value is validated up front,
   * so the save is all-or-nothing.
   */
  async setSettingsBulk(namespace: SettingNamespace, dto: BulkSetSettingsDto, userId?: string): Promise<Record<string, unknown>> {
    for (const entry of dto.settings) {
      const validation = validateSetting(namespace, entry.key, entry.value);
      if (!validation.ok) {
        throw new AppException(validation.code ?? 'CONFIG_INVALID', validation.message ?? 'Invalid setting.', HttpStatus.BAD_REQUEST);
      }
    }

    // One snapshot for the whole change, taken before anything is written.
    const before = await this.getSettings(namespace);
    await this.versionRepo.save(this.versionRepo.create({ namespace, snapshot: before, createdBy: userId ?? null }));

    for (const entry of dto.settings) {
      let setting = await this.settingRepo.findOne({ where: { namespace, key: entry.key } });
      if (setting) {
        setting.value = entry.value;
        setting.updatedBy = userId ?? null;
      } else {
        setting = this.settingRepo.create({ namespace, key: entry.key, value: entry.value, updatedBy: userId ?? null });
      }
      await this.settingRepo.save(setting);
    }
    return this.effectiveNamespace(namespace);
  }

  /**
   * Drops every saved override in a namespace so the platform defaults take over again.
   * The state before the reset is snapshotted first, so it can be restored.
   */
  async resetNamespace(namespace: SettingNamespace, userId?: string): Promise<Record<string, unknown>> {
    const before = await this.getSettings(namespace);
    await this.versionRepo.save(this.versionRepo.create({ namespace, snapshot: before, createdBy: userId ?? null }));
    await this.settingRepo.delete({ namespace });
    return this.effectiveNamespace(namespace);
  }

  // ---- Feature flags ----
  listFlags(): Promise<FeatureFlag[]> {
    return this.flagRepo.find({ order: { key: 'ASC' } });
  }

  async upsertFlag(dto: UpsertFlagDto): Promise<FeatureFlag> {
    let flag = await this.flagRepo.findOne({ where: { key: dto.key } });
    if (!flag) flag = this.flagRepo.create({ key: dto.key, operatorOverrides: {} });
    if (dto.description !== undefined) flag.description = dto.description;
    if (dto.enabledGlobally !== undefined) flag.enabledGlobally = dto.enabledGlobally;
    if (dto.scheduledAt !== undefined) flag.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    return this.flagRepo.save(flag);
  }

  private async requireFlag(key: string): Promise<FeatureFlag> {
    const flag = await this.flagRepo.findOne({ where: { key } });
    if (!flag) throw new AppException('FLAG_NOT_FOUND', 'Feature flag not found.', HttpStatus.NOT_FOUND);
    return flag;
  }

  async setOperatorOverride(key: string, dto: OperatorOverrideDto): Promise<FeatureFlag> {
    const flag = await this.requireFlag(key);
    flag.operatorOverrides = { ...flag.operatorOverrides, [dto.operatorId]: dto.enabled };
    return this.flagRepo.save(flag);
  }

  async clearOperatorOverride(key: string, operatorId: string): Promise<FeatureFlag> {
    const flag = await this.requireFlag(key);
    const next = { ...flag.operatorOverrides };
    delete next[operatorId];
    flag.operatorOverrides = next;
    return this.flagRepo.save(flag);
  }

  async evaluate(key: string, operatorId: string | null): Promise<{ key: string; enabled: boolean }> {
    const flag = await this.requireFlag(key);
    const enabled = evaluateFlag(
      { enabledGlobally: flag.enabledGlobally, scheduledAt: flag.scheduledAt ? flag.scheduledAt.getTime() : null, operatorOverrides: flag.operatorOverrides },
      operatorId,
      Date.now(),
    );
    return { key, enabled };
  }

  // ---- Version history ----
  listVersions(namespace: SettingNamespace): Promise<ConfigVersion[]> {
    return this.versionRepo.find({ where: { namespace }, order: { createdAt: 'DESC' } });
  }

  async compareVersions(aId: string, bId: string): Promise<{ changedKeys: string[]; a: Record<string, unknown>; b: Record<string, unknown> }> {
    const [a, b] = await Promise.all([this.versionRepo.findOne({ where: { id: aId } }), this.versionRepo.findOne({ where: { id: bId } })]);
    if (!a || !b) throw new AppException('VERSION_NOT_FOUND', 'One or both config versions were not found.', HttpStatus.NOT_FOUND);
    return { changedKeys: diffConfig(a.snapshot, b.snapshot), a: a.snapshot, b: b.snapshot };
  }

  async restoreVersion(versionId: string, userId?: string): Promise<Record<string, unknown>> {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new AppException('VERSION_NOT_FOUND', 'Config version not found.', HttpStatus.NOT_FOUND);
    // Snapshot current state first, then re-apply each setting from the chosen version.
    const current = await this.getSettings(version.namespace);
    await this.versionRepo.save(this.versionRepo.create({ namespace: version.namespace, snapshot: current, createdBy: userId ?? null }));
    for (const [key, value] of Object.entries(version.snapshot)) {
      let setting = await this.settingRepo.findOne({ where: { namespace: version.namespace, key } });
      if (setting) setting.value = value;
      else setting = this.settingRepo.create({ namespace: version.namespace, key, value });
      await this.settingRepo.save(setting);
    }
    return this.getSettings(version.namespace);
  }
}
