import { useState } from 'react';
import {
  Badge,
  CASH_STATUS_LABELS,
  ErrorBanner,
  Loader,
  PageHeader,
  Pagination,
  Tone,
  formatDateTime,
  formatMoney,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import { CashSessionStatus, CashSessionView, PaginatedResult } from '@market-pro/shared';

export function CashSessionsPage() {
  const api = useApi();
  const { access } = useAuth();
  const currency = access?.settings?.currency ?? 'PEN';
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const sessions = useAsync(
    () => api.get<PaginatedResult<CashSessionView>>('/sales/cash-sessions', { status, page, pageSize: 25 }),
    [status, page],
  );

  return (
    <>
      <PageHeader title="Cajas" subtitle="Aperturas y cierres de caja" />
      <ErrorBanner error={sessions.error} />
      <div className="card card--flush">
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.values(CashSessionStatus).map((value) => (
              <option key={value} value={value}>
                {CASH_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {sessions.loading && !sessions.data ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cajero</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th className="right">Ventas</th>
                  <th className="right">Esperado</th>
                  <th className="right">Contado</th>
                  <th className="right">Diferencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data?.items.map((session) => (
                  <tr key={session.id}>
                    <td>{session.openedByName}</td>
                    <td>
                      {formatDateTime(session.openedAt)}
                      <div className="muted">{formatMoney(session.openingAmount, currency)}</div>
                    </td>
                    <td>{formatDateTime(session.closedAt)}</td>
                    <td className="right">
                      {session.salesCount} · {formatMoney(session.salesTotal, currency)}
                    </td>
                    <td className="right">{session.expectedAmount === null ? '—' : formatMoney(session.expectedAmount, currency)}</td>
                    <td className="right">{session.closingAmount === null ? '—' : formatMoney(session.closingAmount, currency)}</td>
                    <td className="right">
                      {session.difference === null ? (
                        '—'
                      ) : (
                        <Badge tone={session.difference === 0 ? Tone.SUCCESS : Tone.WARNING}>{formatMoney(session.difference, currency)}</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={session.status === CashSessionStatus.OPEN ? Tone.INFO : Tone.NEUTRAL}>{CASH_STATUS_LABELS[session.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sessions.data && (
          <Pagination page={sessions.data.page} pageSize={sessions.data.pageSize} total={sessions.data.total} onChange={setPage} />
        )}
      </div>
    </>
  );
}
