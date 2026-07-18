import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

const processLogger = new Logger('Process');

/**
 * Process-level safety net (requirement: the backend must never die).
 * Unhandled promise rejections and uncaught exceptions are logged and swallowed so
 * a single bad code path can never take the whole server down. The global
 * AllExceptionsFilter already converts any request-scoped error into a clean JSON
 * response, so these handlers only catch truly out-of-band failures.
 */
function installProcessGuards(): void {
  process.on('unhandledRejection', (reason) => {
    processLogger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });
  process.on('uncaughtException', (err) => {
    processLogger.error(`Uncaught exception (server kept alive): ${err.stack ?? err.message}`);
  });
  process.on('SIGTERM', () => processLogger.log('SIGTERM received'));
  process.on('SIGINT', () => processLogger.log('SIGINT received'));
}

async function bootstrap(): Promise<void> {
  installProcessGuards();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  const port = config.get<number>('app.port') ?? 3000;

  app.setGlobalPrefix(prefix);
  const maxBody = config.get<string>('app.maxBodySize') ?? '1mb';
  app.use(express.json({ limit: maxBody }));
  app.use(express.urlencoded({ limit: maxBody, extended: true }));
  // Hardened security headers.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  const httpAdapter: any = app.getHttpAdapter();
  httpAdapter.getInstance?.()?.disable?.('x-powered-by');

  const origins = (config.get<string>('app.corsOrigins') ?? '*').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins.includes('*') ? true : origins, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Yoo Bus Mobility API')
    .setDescription('Multi-operator SaaS bus booking platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();
  await app.listen(port);
  logger.log(`Yoo Bus running -> http://localhost:${port}/${prefix} (docs: /${prefix}/docs)`);
}

// Retry bootstrap on transient startup failure instead of hard-exiting.
bootstrap().catch((err) => {
  processLogger.error(`Bootstrap failed, retrying in 3s: ${err instanceof Error ? err.stack : String(err)}`);
  setTimeout(() => {
    void bootstrap().catch((e) => processLogger.error(`Retry failed: ${String(e)}`));
  }, 3000);
});
