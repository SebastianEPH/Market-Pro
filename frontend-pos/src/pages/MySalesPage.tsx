import { useState } from 'react';
import {
  Badge,
  ErrorBanner,
  Loader,
  Modal,
  PAYMENT_LABELS,
  PageHeader,
  Pagination,
  SALE_STATUS_LABELS,
  Tone,
  formatDateTime,
  formatMoney,
  todayIso,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import { PaginatedResult, SaleStatus, SaleView } from '@market-pro/shared';
import { Receipt } from '../components/Receipt';

/** Ventas del día del vendedor (el backend filtra por vendedor si no tiene sales:read). */
export function MySalesPage() {
  const api = useApi();
  const { user, access } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [page, setPage] = useState(1);
  const sales = useAsync(
    () => api.get<PaginatedResult<SaleView>>('/sales/sales', { from: date, to: date, page, pageSize: 25 }),
    [date, page],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useAsync(() => (selectedId ? api.get<SaleView>(`/sales/sales/${selectedId}`) : Promise.resolve(null)), [selectedId]);

  return (
    <>
      <PageHeader title="Mis ventas" actions={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />} />
      <ErrorBanner error={sales.error} />
      <div className="card card--flush">
        {sales.loading && !sales.data ? (
          <Loader />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Hora</th>
                <th>Pago</th>
                <th className="right">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.data?.items.map((sale) => (
                <tr key={sale.id} onClick={() => setSelectedId(sale.id)} style={{ cursor: 'pointer' }}>
                  <td className="mono">#{sale.number}</td>
                  <td>{formatDateTime(sale.createdAt)}</td>
                  <td>{PAYMENT_LABELS[sale.paymentMethod]}</td>
                  <td className="right">{formatMoney(sale.total, sale.currency)}</td>
                  <td>
                    <Badge tone={sale.status === SaleStatus.COMPLETED ? Tone.SUCCESS : Tone.DANGER}>{SALE_STATUS_LABELS[sale.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sales.data && <Pagination page={sales.data.page} pageSize={sales.data.pageSize} total={sales.data.total} onChange={setPage} />}
      </div>

      <Modal
        open={selectedId !== null}
        title="Ticket"
        onClose={() => setSelectedId(null)}
        footer={
          <button className="btn" onClick={() => window.print()}>
            🖨 Reimprimir
          </button>
        }
      >
        {detail.data ? (
          <Receipt sale={detail.data} storeName={user?.tenant?.name ?? ''} footer={access?.settings?.receiptFooter} />
        ) : (
          <Loader />
        )}
      </Modal>
    </>
  );
}
