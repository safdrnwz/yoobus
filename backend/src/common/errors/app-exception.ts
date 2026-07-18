import { HttpException, HttpStatus } from '@nestjs/common';

// Every business error carries a stable code and a clear, human-friendly message.
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: any,
  ) {
    super({ code, message, details }, status);
  }
}
