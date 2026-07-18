import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ApiKey } from '../../platform/api-management/entities/api-key.entity';

/** Authenticates inbound OTA calls via the `x-api-key` header (hashed lookup). */
@Injectable()
export class OtaApiKeyGuard implements CanActivate {
  constructor(@InjectRepository(ApiKey) private readonly keyRepo: Repository<ApiKey>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const raw = (req.headers['x-api-key'] || '').toString();
    if (!raw) throw new UnauthorizedException('Missing x-api-key');
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const key = await this.keyRepo.findOne({ where: { keyHash, status: 'ACTIVE' as any } });
    if (!key) throw new UnauthorizedException('Invalid API key');
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('API key expired');
    key.lastUsedAt = new Date();
    await this.keyRepo.save(key);
    req.otaPartnerId = key.partnerId;
    req.otaScopes = key.scopes ?? [];
    return true;
  }
}
