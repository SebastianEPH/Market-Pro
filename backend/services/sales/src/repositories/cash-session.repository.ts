import { injectable } from 'inversify';
import { DbExecutor, pageOffset } from '@market-pro/core';
import { CashSessionView } from '@market-pro/shared';
import { CashSessionListQuery } from '../schemas/sales.schemas.js';

export interface NewCashSession {
  tenantId: string;
  openedBy: string;
  openedByName: string;
  openingAmount: number;
  notes?: string | null;
}

export interface CashSessionClose {
  closedBy: string;
  closingAmount: number;
  expectedAmount: number;
  difference: number;
  notes?: string | null;
}

export interface ICashSessionRepository {
  findOpenByUser(db: DbExecutor, userId: string): Promise<CashSessionView | null>;
  get(db: DbExecutor, id: string): Promise<CashSessionView | null>;
  list(db: DbExecutor, filter: CashSessionListQuery): Promise<{ items: CashSessionView[]; total: number }>;
  open(db: DbExecutor, data: NewCashSession): Promise<string>;
  close(db: DbExecutor, id: string, data: CashSessionClose): Promise<boolean>;
}

const VIEW = `
  SELECT cs.id, cs.opened_by AS "openedBy", cs.opened_by_name AS "openedByName",
         cs.opening_amount AS "openingAmount", cs.opened_at AS "openedAt",
         cs.closed_by AS "closedBy", cs.closing_amount AS "closingAmount",
         cs.expected_amount AS "expectedAmount", cs.difference, cs.closed_at AS "closedAt",
         cs.status, cs.notes,
         coalesce(s.sales_count, 0) AS "salesCount",
         coalesce(s.sales_total, 0) AS "salesTotal",
         coalesce(s.cash_total, 0) AS "cashSalesTotal"
    FROM cash_sessions cs
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS sales_count,
             sum(total) AS sales_total,
             sum(total) FILTER (WHERE payment_method = 'CASH') AS cash_total
        FROM sales WHERE cash_session_id = cs.id AND status = 'COMPLETED'
    ) s ON true`;

@injectable()
export class PgCashSessionRepository implements ICashSessionRepository {
  findOpenByUser(db: DbExecutor, userId: string): Promise<CashSessionView | null> {
    return db.maybeOne<CashSessionView>(`${VIEW} WHERE cs.opened_by = $1 AND cs.status = 'OPEN'`, [userId]);
  }

  get(db: DbExecutor, id: string): Promise<CashSessionView | null> {
    return db.maybeOne<CashSessionView>(`${VIEW} WHERE cs.id = $1`, [id]);
  }

  async list(db: DbExecutor, filter: CashSessionListQuery): Promise<{ items: CashSessionView[]; total: number }> {
    const params: unknown[] = [];
    let whereSql = '';
    if (filter.status) {
      params.push(filter.status);
      whereSql = `WHERE cs.status = $1`;
    }
    const totalRow = await db.one<{ total: number }>(
      `SELECT count(*)::int AS total FROM cash_sessions cs ${whereSql}`,
      params,
    );
    const items = await db.query<CashSessionView>(
      `${VIEW} ${whereSql} ORDER BY cs.opened_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }

  async open(db: DbExecutor, data: NewCashSession): Promise<string> {
    const row = await db.one<{ id: string }>(
      `INSERT INTO cash_sessions (tenant_id, opened_by, opened_by_name, opening_amount, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.tenantId, data.openedBy, data.openedByName, data.openingAmount, data.notes ?? null],
    );
    return row.id;
  }

  async close(db: DbExecutor, id: string, data: CashSessionClose): Promise<boolean> {
    const affected = await db.execute(
      `UPDATE cash_sessions
          SET status = 'CLOSED', closed_by = $2, closing_amount = $3, expected_amount = $4,
              difference = $5, closed_at = now(), notes = coalesce($6, notes)
        WHERE id = $1 AND status = 'OPEN'`,
      [id, data.closedBy, data.closingAmount, data.expectedAmount, data.difference, data.notes ?? null],
    );
    return affected > 0;
  }
}
