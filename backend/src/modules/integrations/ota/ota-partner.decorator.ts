import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated OTA partner id (set by OtaApiKeyGuard). */
export const OtaPartner = createParamDecorator((_d: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().otaPartnerId;
});
