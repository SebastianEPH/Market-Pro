import { z } from 'zod';

export const uuidSchema = z.uuid({ message: 'Identificador inválido' });

/** Paginación estándar para query strings (los valores llegan como texto). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Convierte '' en undefined para filtros opcionales de la query. */
export const optionalQueryText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Booleano en query string: 'true' | 'false'. */
export const queryBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/** Montos: se redondean a 2 decimales (los cálculos internos se hacen en céntimos). */
export const moneySchema = z.coerce
  .number()
  .min(0)
  .max(99_999_999.99)
  .transform((value) => Math.round(value * 100) / 100);

export const quantitySchema = z.coerce.number().positive().max(9_999_999.999);
