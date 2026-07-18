import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiPartner } from './entities/api-partner.entity';
import { ApiKey } from './entities/api-key.entity';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { ApiVersion } from './entities/api-version.entity';
import { CreateVersionDto, GenerateKeyDto, RegisterPartnerDto, RegisterWebhookDto, TestWebhookDto } from './dto/api.dto';
import { AppException } from '../../../common/errors/app-exception';
import {
  ApiVersionStatus, computeWebhookSignature, maskApiKey, partnerCanTransition, PartnerStatus,
} from '../../../common/logic/api-management.util';

/** SuperAdmin API Management: partners, API keys, webhooks, and API versions. */
@Injectable()
export class ApiManagementService {
  constructor(
    @InjectRepository(ApiPartner) private readonly partnerRepo: Repository<ApiPartner>,
    @InjectRepository(ApiKey) private readonly keyRepo: Repository<ApiKey>,
    @InjectRepository(Webhook) private readonly webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDelivery) private readonly deliveryRepo: Repository<WebhookDelivery>,
    @InjectRepository(ApiVersion) private readonly versionRepo: Repository<ApiVersion>,
  ) {}

  private guard(result: { ok: boolean; code?: string; message?: string }): void {
    if (!result.ok) throw new AppException(result.code ?? 'API_INVALID', result.message ?? 'Invalid API request.', HttpStatus.BAD_REQUEST);
  }

  // ---- Partners ----
  async registerPartner(dto: RegisterPartnerDto): Promise<ApiPartner> {
    const existing = await this.partnerRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new AppException('PARTNER_DUPLICATE', 'A partner with this email already exists.', HttpStatus.CONFLICT);
    return this.partnerRepo.save(
      this.partnerRepo.create({
        name: dto.name, email: dto.email, callbackUrl: dto.callbackUrl ?? null,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 60, scopes: dto.scopes ?? [], status: 'PENDING',
      }),
    );
  }

  listPartners(): Promise<ApiPartner[]> {
    return this.partnerRepo.find({ order: { createdAt: 'DESC' } });
  }

  private async requirePartner(id: string): Promise<ApiPartner> {
    const partner = await this.partnerRepo.findOne({ where: { id } });
    if (!partner) throw new AppException('PARTNER_NOT_FOUND', 'API partner not found.', HttpStatus.NOT_FOUND);
    return partner;
  }

  async setPartnerStatus(id: string, to: PartnerStatus, reason?: string): Promise<ApiPartner> {
    const partner = await this.requirePartner(id);
    this.guard(partnerCanTransition(partner.status, to));
    partner.status = to;
    partner.statusReason = reason ?? null;
    return this.partnerRepo.save(partner);
  }

  // ---- API keys ----
  async generateKey(partnerId: string, dto: GenerateKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const partner = await this.requirePartner(partnerId);
    if (partner.status !== 'APPROVED') throw new AppException('PARTNER_NOT_APPROVED', 'Only an approved partner can be issued API keys.', HttpStatus.BAD_REQUEST);
    const rawKey = `tbk_live_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.keyRepo.save(
      this.keyRepo.create({
        partnerId, name: dto.name, keyPrefix: 'tbk_live_', keyMasked: maskApiKey(rawKey), keyHash,
        scopes: dto.scopes ?? partner.scopes, status: 'ACTIVE',
        expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * 86400000) : null,
      }),
    );
    // The raw key is returned exactly once and never stored.
    return { apiKey, rawKey };
  }

  listKeys(partnerId: string): Promise<ApiKey[]> {
    return this.keyRepo.find({ where: { partnerId }, order: { createdAt: 'DESC' } });
  }

  async revokeKey(keyId: string): Promise<ApiKey> {
    const key = await this.keyRepo.findOne({ where: { id: keyId } });
    if (!key) throw new AppException('API_KEY_NOT_FOUND', 'API key not found.', HttpStatus.NOT_FOUND);
    key.status = 'REVOKED';
    return this.keyRepo.save(key);
  }

  // ---- Webhooks ----
  async registerWebhook(partnerId: string, dto: RegisterWebhookDto): Promise<Webhook> {
    await this.requirePartner(partnerId);
    return this.webhookRepo.save(
      this.webhookRepo.create({
        partnerId, url: dto.url, eventTypes: dto.eventTypes, secret: randomBytes(16).toString('hex'),
        active: true, maxAttempts: dto.maxAttempts ?? 5,
      }),
    );
  }

  listWebhooks(partnerId: string): Promise<Webhook[]> {
    return this.webhookRepo.find({ where: { partnerId }, order: { createdAt: 'DESC' } });
  }

  async testWebhook(webhookId: string, dto: TestWebhookDto): Promise<{ delivery: WebhookDelivery; signature: string }> {
    const webhook = await this.webhookRepo.findOne({ where: { id: webhookId } });
    if (!webhook) throw new AppException('WEBHOOK_NOT_FOUND', 'Webhook not found.', HttpStatus.NOT_FOUND);
    const payload = JSON.stringify({ event: dto.event, data: dto.payload });
    const signature = computeWebhookSignature(payload, webhook.secret);
    // We record the signed delivery; actual HTTP dispatch happens in a delivery worker.
    const delivery = await this.deliveryRepo.save(
      this.deliveryRepo.create({ webhookId, event: dto.event, payload, signature, status: 'PENDING', attempts: 1 }),
    );
    return { delivery, signature };
  }

  deliveries(webhookId: string): Promise<WebhookDelivery[]> {
    return this.deliveryRepo.find({ where: { webhookId }, order: { createdAt: 'DESC' } });
  }

  // ---- Versions ----
  async createVersion(dto: CreateVersionDto): Promise<ApiVersion> {
    const existing = await this.versionRepo.findOne({ where: { version: dto.version } });
    if (existing) throw new AppException('API_VERSION_DUPLICATE', 'This API version already exists.', HttpStatus.CONFLICT);
    return this.versionRepo.save(this.versionRepo.create({ version: dto.version, status: 'ACTIVE' }));
  }

  listVersions(): Promise<ApiVersion[]> {
    return this.versionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async setVersionStatus(id: string, status: ApiVersionStatus): Promise<ApiVersion> {
    const version = await this.versionRepo.findOne({ where: { id } });
    if (!version) throw new AppException('API_VERSION_NOT_FOUND', 'API version not found.', HttpStatus.NOT_FOUND);
    version.status = status;
    if (status === 'DEPRECATED') version.deprecatedAt = new Date();
    if (status === 'RETIRED') version.retiredAt = new Date();
    return this.versionRepo.save(version);
  }
}
