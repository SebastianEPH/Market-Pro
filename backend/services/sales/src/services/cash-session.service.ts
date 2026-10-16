import { inject, injectable } from 'inversify';
import { BadRequestError, ConflictError, CoreToken, Database, ForbiddenError, NotFoundError, Principal } from '@market-pro/core';
import { AccessProfile, CashSessionStatus, CashSessionView, ErrorCode, PaginatedResult } from '@market-pro/shared';
import { ICashSessionRepository } from '../repositories/cash-session.repository.js';
import { SalesToken } from '../sales-token.enum.js';
import { CashSessionListQuery, CloseCashSessionDto, OpenCashSessionDto } from '../schemas/sales.schemas.js';
import { fromCents, toCents } from './money.js';

@injectable()
export class CashSessionService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(SalesToken.CashSessionRepository) private readonly sessions: ICashSessionRepository,
  ) {}

  current(tenantId: string, userId: string): Promise<CashSessionView | null> {
    return this.db.withTenant(tenantId, (tx) => this.sessions.findOpenByUser(tx, userId));
  }

  async list(tenantId: string, query: CashSessionListQuery): Promise<PaginatedResult<CashSessionView>> {
    const result = await this.db.withTenant(tenantId, (tx) => this.sessions.list(tx, query));
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(tenantId: string, id: string): Promise<CashSessionView> {
    const session = await this.db.withTenant(tenantId, (tx) => this.sessions.get(tx, id));
    if (!session) throw new NotFoundError('Caja');
    return session;
  }

  async open(tenantId: string, principal: Principal, dto: OpenCashSessionDto): Promise<CashSessionView> {
    const id = await this.db.withTenant(tenantId, async (tx) => {
      if (await this.sessions.findOpenByUser(tx, principal.subjectId)) {
        throw new ConflictError('Ya tienes una caja abierta');
      }
      return this.sessions.open(tx, {
        tenantId,
        openedBy: principal.subjectId,
        openedByName: principal.name,
        openingAmount: dto.openingAmount,
        notes: dto.notes,
      });
    });
    return this.get(tenantId, id);
  }

  /** Cierra la caja calculando el esperado (apertura + ventas en efectivo) y la diferencia. */
  async close(access: AccessProfile, id: string, dto: CloseCashSessionDto): Promise<CashSessionView> {
    const tenantId = access.tenantId as string;
    await this.db.withTenant(tenantId, async (tx) => {
      const session = await this.sessions.get(tx, id);
      if (!session) throw new NotFoundError('Caja');
      if (session.status !== CashSessionStatus.OPEN) throw new BadRequestError('La caja ya está cerrada');
      if (session.openedBy !== access.subjectId && !access.isOwner) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Solo quien abrió la caja (o el dueño) puede cerrarla');
      }
      const expectedCents = toCents(session.openingAmount) + toCents(session.cashSalesTotal);
      const closingCents = toCents(dto.closingAmount);
      await this.sessions.close(tx, id, {
        closedBy: access.subjectId,
        closingAmount: fromCents(closingCents),
        expectedAmount: fromCents(expectedCents),
        difference: fromCents(closingCents - expectedCents),
        notes: dto.notes,
      });
    });
    return this.get(tenantId, id);
  }
}
