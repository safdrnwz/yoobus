import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const status = ctx.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(map((data) => ({ success: true, statusCode: status, data })));
  }
}
