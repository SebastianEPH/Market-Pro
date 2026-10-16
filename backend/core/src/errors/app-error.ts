import { ErrorCode } from '@market-pro/shared';
import { HttpStatus } from '../enums/core.enums.js';

/** Error de aplicación con estado HTTP y código estable para el cliente. */
export class AppError extends Error {
  constructor(
    public readonly status: HttpStatus,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Solicitud inválida', details?: unknown) {
    super(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = 'Los datos enviados no son válidos') {
    super(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: ErrorCode = ErrorCode.UNAUTHORIZED, message = 'No autenticado') {
    super(HttpStatus.UNAUTHORIZED, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: ErrorCode = ErrorCode.FORBIDDEN, message = 'No tienes acceso a este recurso', details?: unknown) {
    super(HttpStatus.FORBIDDEN, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', code: ErrorCode = ErrorCode.NOT_FOUND) {
    super(HttpStatus.NOT_FOUND, code, `${resource} no encontrado`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONFLICT, details?: unknown) {
    super(HttpStatus.CONFLICT, code, message, details);
  }
}
