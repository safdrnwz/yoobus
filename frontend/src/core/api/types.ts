/** The envelope every successful Yoo Bus response is wrapped in (TransformInterceptor). */
export interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

/** The envelope every failure is wrapped in (AllExceptionsFilter). */
export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  path?: string;
  correlationId?: string | null;
  timestamp?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

export type Id = string;
