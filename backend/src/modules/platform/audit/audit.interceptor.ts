import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const MUTATING = ['POST', 'PATCH', 'PUT', 'DELETE'];

/**
 * Records every mutating request to the immutable audit trail (MCA Rule 3(1):
 * edit log of each change, cannot be disabled, tamper-proof, retained 8 years).
 * Logs both successful and failed mutations. Never throws.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method: string = req.method;
    if (!MUTATING.includes(method)) return next.handle();

    const handler = context.getHandler()?.name;
    const controller = context.getClass()?.name;
    const action = controller && handler ? `${controller}.${handler}` : null;
    const user = req.user;
    const rawIp = (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '') as string;
    const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;

    const persist = (statusCode: number): void => {
      void this.audit.record({
        userId: user?.id ?? null,
        role: user?.role ?? null,
        operatorId: user?.operatorId ?? null,
        method,
        path: req.originalUrl ?? req.url,
        statusCode,
        ipAddress: ip,
        userAgent,
        action,
        correlationId: req.correlationId ?? null,
      });
    };

    return next.handle().pipe(
      tap(() => persist(res.statusCode)),
      catchError((err) => {
        persist(err?.status ?? res.statusCode ?? 500);
        return throwError(() => err);
      }),
    );
  }
}
