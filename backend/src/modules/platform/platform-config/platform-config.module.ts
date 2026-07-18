import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { ConfigVersion } from './entities/config-version.entity';
import { PlatformConfigService } from './platform-config.service';
import { PlatformConfigController } from './platform-config.controller';
import { AppearanceController } from './appearance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting, FeatureFlag, ConfigVersion])],
  controllers: [PlatformConfigController, AppearanceController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
