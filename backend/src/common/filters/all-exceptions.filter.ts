import { QueryFailedError } from 'typeorm';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../errors/app-exception';

/**
 * Catches every error in the request pipeline and returns a clean JSON envelope.
 * This is the first line of "the backend never dies": no thrown error escapes to
 * crash the process; the worst case is a 500 JSON response. The filter itself is
 * wrapped in try/catch so even a serialization failure cannot throw.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      const ctx = host.switchToHttp();
      const res = ctx.getResponse<Response>();
      const req = ctx.getRequest<Request>();

      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let code = 'INTERNAL_ERROR';
      let message = 'Something went wrong. Please try again shortly.';
      let details: unknown = undefined;

      if (exception instanceof AppException) {
        status = exception.getStatus();
        const r = exception.getResponse() as { code: string; message: string; details?: unknown };
        code = r.code;
        message = r.message;
        details = r.details;
      } else if (exception instanceof HttpException) {
        status = exception.getStatus();
        const r = exception.getResponse() as string | { message?: string | string[] };
        message = typeof r === 'string' ? r : Array.isArray(r.message) ? r.message.join(', ') : r.message ?? message;
        code =
          status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'REQUEST_ERROR';
        if (typeof r !== 'string' && Array.isArray(r.message)) details = r.message;
      } else if (exception instanceof QueryFailedError) {
        // A malformed id in the URL (e.g. /buses/not-a-uuid) reaches Postgres as
        // `invalid input syntax for type uuid` and used to surface as a 500 — a client
        // mistake reported as a server fault. Postgres 22P02 = invalid text representation.
        // The caller sent a bad request; say so, and never echo the raw driver text back.
        const pgCode = (exception as QueryFailedError & { code?: string }).code;
        if (pgCode === '22P02') {
          status = HttpStatus.BAD_REQUEST;
          code = 'INVALID_ID';
          message = 'One of the identifiers in this request is not a valid id.';
        } else if (pgCode === '23505') {
          status = HttpStatus.CONFLICT;
          code = 'DUPLICATE';
          message = 'A record with these details already exists.';
        } else if (pgCode === '23503') {
          status = HttpStatus.BAD_REQUEST;
          code = 'RELATED_RECORD_MISSING';
          message = 'This request references a record that does not exist.';
        } else {
          message = 'Something went wrong. Please try again shortly.';
        }
      } else if (exception instanceof Error) {
        // Do NOT expose internal error text to the client (info-leak guard).
        // The real message/stack is logged server-side below for 500s.
        message = 'Something went wrong. Please try again shortly.';
      }

      if (status >= 500) {
        this.logger.error(
          `${req?.method} ${req?.url} -> ${code} [cid=${(req as any)?.correlationId ?? '-'}]`,
          (exception as Error)?.stack,
        );
      }

      if (!res.headersSent) {
        res.status(status).json({
          success: false,
          error: { code, message, details },
          path: req?.url,
          correlationId: (req as any)?.correlationId ?? null,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (filterError) {
      // Absolute last resort — never let the error filter itself throw.
      this.logger.error(`Exception filter failed: ${String(filterError)}`);
    }
  }
}
