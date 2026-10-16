import { useState } from 'react';
import {
  Badge,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PAYMENT_LABELS,
  PageHeader,
  Pagination,
  SALE_STATUS_LABELS,
  Tone,
  formatDateTime,
  formatMoney,
  formatNumber,
  todayIso,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import { FeatureCode, ModuleCode, PaginatedResult, PermissionAction, SaleStatus, SaleView } from '@market-pro/shared';

export function SalesPage() {
  const api = useApi();
  const { can, feature } = useAuth();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const sales = useAsync(
    () => api.get<PaginatedResult<SaleView>>('/sales/sales', { from, to, status, page, pageSize: 25 }),
    [from, to, status, page],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useAsync(() => (selectedId ? api.get<SaleView>(`/sales/sales/${selectedId}`) : Promise.resolve(null)), [selectedId]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  const canVoid = can(ModuleCode.SALES, PermissionAction.DELETE) && feature(FeatureCode.SALES_VOID);

  const voidSale = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      detail.setData(await api.post<SaleView>(`/sales/sales/${selectedId}/void`, { reason }));
      setReason('');
      sales.reload();
    } catch (err) {
      setError(err);
    }
  };

  const sale = detail.data;

  return (
    <>
      <PageHeader title="Ventas" subtitle="Historial de ventas de la tienda" />
      <ErrorBanner error={sales.error} />
      <div className="card card--flush">
        <div className="toolbar">
          <label className="row">
            Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="row">
            Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.values(SaleStatus).map((value) => (
              <option key={value} value={value}>
                {SALE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {sales.loading && !sales.data ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th className="right">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.data?.items.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">#{item.number}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.sellerName}</td>
                    <td>{item.customerName ?? '—'}</td>
                    <td>{PAYMENT_LABELS[item.paymentMethod]}</td>
                    <td className="right">{formatMoney(item.total, item.currency)}</td>
                    <td>
                      <Badge tone={item.status === SaleStatus.COMPLETED ? Tone.SUCCESS : Tone.DANGER}>{SALE_STATUS_LABELS[item.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sales.data && <Pagination page={sales.data.page} pageSize={sales.data.pageSize} total={sales.data.total} onChange={setPage} />}
      </div>

      <Modal open={selectedId !== null} title={sale ? `Venta #${sale.number}` : 'Venta'} onClose={() => setSelectedId(null)} wide>
        {!sale ? (
          <Loader />
        ) : (
          <>
            <ErrorBanner error={error} />
            <div className="grid grid--4">
              <div>
                <span className="muted">Fecha</span>
                <div>{formatDateTime(sale.createdAt)}</div>
              </div>
              <div>
                <span className="muted">Vendedor</span>
                <div>{sale.sellerName}</div>
              </div>
              <div>
                <span className="muted">Pago</span>
                <div>{PAYMENT_LABELS[sale.paymentMethod]}</div>
              </div>
              <div>
                <span className="muted">Estado</span>
                <div>
                  <Badge tone={sale.status === SaleStatus.COMPLETED ? Tone.SUCCESS : Tone.DANGER}>{SALE_STATUS_LABELS[sale.status]}</Badge>
                </div>
              </div>
            </div>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="right">Cant.</th>
                  <th className="right">P. unit.</th>
                  <th className="right">Desc.</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td className="right">{formatNumber(item.quantity)}</td>
                    <td className="right">{formatMoney(item.unitPrice, sale.currency)}</td>
                    <td className="right">{formatMoney(item.discount, sale.currency)}</td>
                    <td className="right">{formatMoney(item.lineTotal, sale.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
              <span>Subtotal: {formatMoney(sale.subtotal, sale.currency)}</span>
              <span>Impuesto: {formatMoney(sale.taxTotal, sale.currency)}</span>
              <span>Descuentos: {formatMoney(sale.discountTotal, sale.currency)}</span>
              <strong>Total: {formatMoney(sale.total, sale.currency)}</strong>
            </div>
            {sale.status === SaleStatus.VOIDED && (
              <div className="alert alert--danger">
                Anulada el {formatDateTime(sale.voidedAt)}: {sale.voidReason}
              </div>
            )}
            {sale.status === SaleStatus.COMPLETED && canVoid && (
              <div className="row">
                <Field label="Motivo de anulación">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: error de cobro" />
                </Field>
                <button className="btn btn--danger" disabled={reason.trim().length < 3} onClick={() => void voidSale()}>
                  Anular venta
                </button>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
