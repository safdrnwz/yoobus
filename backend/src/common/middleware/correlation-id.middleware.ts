import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Attaches a correlation id to every request (Rule 061, 138) so requests are traceable.
 * Echoes the incoming X-Request-Id when present, otherwise generates one.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId = req.headers['x-request-id'];
    const id = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
    (req as any).correlationId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
