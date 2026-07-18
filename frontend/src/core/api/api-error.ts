import type { ApiErrorEnvelope } from './types';

/**
 * One error type for the whole app. Anything thrown out of the API layer is an ApiError,
 * so callers never have to guess whether they hold an Axios error, a network failure, or
 * a backend envelope.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly correlationId?: string | null;

  constructor(params: { code: string; message: string; status: number; details?: unknown; correlationId?: string | null }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.correlationId = params.correlationId ?? null;
  }

  /** Validation failures arrive as an array of messages from class-validator. */
  get fieldMessages(): string[] {
    return Array.isArray(this.details) ? (this.details as string[]) : [];
  }

  /**
   * Those messages, attached to the fields they are about.
   *
   * class-validator always names the property first — "mobile must be 10 digits",
   * "seatNumbers must contain at least 1 element", "stops.0.stopId must be a UUID". So the
   * first token is the field, and the message belongs under that input rather than in a
   * toast that vanishes while the user is still looking for what they got wrong.
   *
   * A form that shows "That could not be saved" is telling the user nothing they can act on.
   */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const message of this.fieldMessages) {
      const m = /^([A-Za-z_][\w.]*)\s/.exec(message);
      if (!m) continue;
      // `stops.0.stopId` is about the `stops` control, not a field called "stops.0.stopId".
      const field = m[1].split('.')[0];
      if (!out[field]) out[field] = message;
    }
    return out;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** A 5xx or a dropped connection can succeed on retry; a 400 never will. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 0;
  }
}

/** Turns anything Axios can throw into a single, predictable ApiError. */
export function toApiError(error: unknown): ApiError {
  const axiosLike = error as {
    response?: { status?: number; data?: ApiErrorEnvelope };
    request?: unknown;
    message?: string;
    code?: string;
  };

  const envelope = axiosLike?.response?.data;
  if (envelope?.error) {
    return new ApiError({
      code: envelope.error.code,
      message: envelope.error.message,
      status: axiosLike.response?.status ?? 500,
      details: envelope.error.details,
      correlationId: envelope.correlationId,
    });
  }

  // The request left the browser but nothing came back: offline, DNS, CORS, server down.
  if (axiosLike?.request) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: "Can't reach the server. Check your connection and try again.",
      status: 0,
    });
  }

  return new ApiError({
    code: axiosLike?.code ?? 'UNKNOWN_ERROR',
    message: axiosLike?.message ?? 'Something went wrong. Please try again.',
    status: 500,
  });
}
