import { inject, injectable } from 'inversify';
import { CoreToken, Database } from '@market-pro/core';
import { AccessProfile, DashboardSummary } from '@market-pro/shared';
import { IDashboardRepository } from '../repositories/dashboard.repository.js';
import { SalesToken } from '../sales-token.enum.js';
import { fromCents, toCents } from './money.js';

@injectable()
export class DashboardService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(SalesToken.DashboardRepository) private readonly dashboard: IDashboardRepository,
  ) {}

  async summary(access: AccessProfile): Promise<DashboardSummary> {
    const tenantId = access.tenantId as string;
    const timezone = access.settings?.timezone ?? 'America/Lima';

    return this.db.withTenant(tenantId, async (tx) => {
      const today = await this.dashboard.today(tx, timezone);
      return {
        currency: access.settings?.currency ?? 'PEN',
        todayTotal: today.total,
        todayCount: today.count,
        averageTicket: today.count > 0 ? fromCents(toCents(today.total) / today.count) : 0,
        openCashSessions: await this.dashboard.openCashSessions(tx),
        last7Days: await this.dashboard.lastDays(tx, timezone, 7),
        paymentsToday: await this.dashboard.paymentsToday(tx, timezone),
        topProducts: await this.dashboard.topProducts(tx, 30, 5),
      };
    });
  }
}
