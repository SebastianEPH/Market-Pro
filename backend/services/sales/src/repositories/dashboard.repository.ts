import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { DashboardDayPoint, DashboardPaymentBreakdown, DashboardTopProduct } from '@market-pro/shared';

export interface TodayTotals {
  total: number;
  count: number;
}

export interface IDashboardRepository {
  today(db: DbExecutor, timezone: string): Promise<TodayTotals>;
  lastDays(db: DbExecutor, timezone: string, days: number): Promise<DashboardDayPoint[]>;
  paymentsToday(db: DbExecutor, timezone: string): Promise<DashboardPaymentBreakdown[]>;
  topProducts(db: DbExecutor, days: number, limit: number): Promise<DashboardTopProduct[]>;
  openCashSessions(db: DbExecutor): Promise<number>;
}

/** Inicio del día actual en la zona horaria de la tienda. */
const TODAY_START = `(date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)`;

@injectable()
export class PgDashboardRepository implements IDashboardRepository {
  today(db: DbExecutor, timezone: string): Promise<TodayTotals> {
    return db.one<TodayTotals>(
      `SELECT coalesce(sum(total), 0) AS total, count(*)::int AS count
         FROM sales WHERE status = 'COMPLETED' AND created_at >= ${TODAY_START}`,
      [timezone],
    );
  }

  lastDays(db: DbExecutor, timezone: string, days: number): Promise<DashboardDayPoint[]> {
    return db.query<DashboardDayPoint>(
      `WITH days AS (
         SELECT generate_series((now() AT TIME ZONE $1)::date - ($2::int - 1), (now() AT TIME ZONE $1)::date, '1 day')::date AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              coalesce(sum(s.total), 0) AS total,
              count(s.id)::int AS count
         FROM days d
         LEFT JOIN sales s
           ON s.status = 'COMPLETED' AND (s.created_at AT TIME ZONE $1)::date = d.day
        GROUP BY d.day ORDER BY d.day`,
      [timezone, days],
    );
  }

  paymentsToday(db: DbExecutor, timezone: string): Promise<DashboardPaymentBreakdown[]> {
    return db.query<DashboardPaymentBreakdown>(
      `SELECT payment_method AS "paymentMethod", coalesce(sum(total), 0) AS total, count(*)::int AS count
         FROM sales WHERE status = 'COMPLETED' AND created_at >= ${TODAY_START}
        GROUP BY payment_method ORDER BY total DESC`,
      [timezone],
    );
  }

  topProducts(db: DbExecutor, days: number, limit: number): Promise<DashboardTopProduct[]> {
    return db.query<DashboardTopProduct>(
      `SELECT si.product_id AS "productId", max(si.product_name) AS "productName",
              sum(si.quantity) AS quantity, sum(si.line_total) AS total
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE s.status = 'COMPLETED' AND s.created_at >= now() - make_interval(days => $1::int)
        GROUP BY si.product_id ORDER BY total DESC LIMIT $2`,
      [days, limit],
    );
  }

  async openCashSessions(db: DbExecutor): Promise<number> {
    const row = await db.one<{ total: number }>(
      `SELECT count(*)::int AS total FROM cash_sessions WHERE status = 'OPEN'`,
    );
    return row.total;
  }
}
