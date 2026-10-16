import { ErrorCode } from '@market-pro/shared';
import { HttpStatus, PgErrorCode } from '../enums/core.enums.js';
import { AppError } from './app-error.js';

interface PgLikeError {
  code: string;
  constraint?: string;
  detail?: string;
  column?: string;
}

function isPgError(error: unknown): error is PgLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((error as { code: string }).code)
  );
}

/** Traduce errores de PostgreSQL a errores HTTP comprensibles. */
export function mapDatabaseError(error: unknown): AppError | null {
  if (!isPgError(error)) return null;
  const details = { constraint: error.constraint, column: error.column };

  switch (error.code) {
    case PgErrorCode.UNIQUE_VIOLATION:
      return new AppError(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Ya existe un registro con esos datos', details);
    case PgErrorCode.FOREIGN_KEY_VIOLATION:
      return new AppError(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'El registro está relacionado con otros datos', details);
    case PgErrorCode.NOT_NULL_VIOLATION:
    case PgErrorCode.CHECK_VIOLATION:
    case PgErrorCode.NUMERIC_VALUE_OUT_OF_RANGE:
      return new AppError(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Datos inválidos para la base de datos', details);
    case PgErrorCode.INVALID_TEXT_REPRESENTATION:
      return new AppError(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, 'Formato de identificador o valor inválido');
    case PgErrorCode.INSUFFICIENT_PRIVILEGE:
      return new AppError(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'Operación no permitida');
    default:
      return null;
  }
}
