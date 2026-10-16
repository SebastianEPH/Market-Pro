import { ErrorBanner, Loader, PAYMENT_LABELS, PageHeader, formatMoney, formatNumber, useApi, useAsync } from '@market-pro/frontend-common';
import { DashboardSummary } from '@market-pro/shared';

export function DashboardPage() {
  const api = useApi();
  const { data, error, loading } = useAsync(() => api.get<DashboardSummary>('/sales/dashboard/summary'), []);

  if (loading && !data) return <Loader />;
  if (!data) return <ErrorBanner error={error} />;

  const max = Math.max(1, ...data.last7Days.map((day) => day.total));
  const money = (value: number) => formatMoney(value, data.currency);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de ventas de hoy" />
      <div className="grid grid--4">
        <div className="card stat">
          <span className="muted">Ventas de hoy</span>
          <strong>{money(data.todayTotal)}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Tickets</span>
          <strong>{data.todayCount}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Ticket promedio</span>
          <strong>{money(data.averageTicket)}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Cajas abiertas</span>
          <strong>{data.openCashSessions}</strong>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card stack">
          <h2>Últimos 7 días</h2>
          <div className="bars">
            {data.last7Days.map((day) => (
              <div className="bars__item" key={day.day} title={`${day.day}: ${money(day.total)} (${day.count})`}>
                <div className="bars__bar" style={{ height: `${(day.total / max) * 100}%` }} />
                <span className="bars__label">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card stack">
          <h2>Medios de pago (hoy)</h2>
          {data.paymentsToday.length === 0 && <p className="muted">Sin ventas hoy.</p>}
          {data.paymentsToday.map((payment) => (
            <div className="row row--between" key={payment.paymentMethod}>
              <span>
                {PAYMENT_LABELS[payment.paymentMethod]} <span className="muted">({payment.count})</span>
              </span>
              <strong>{money(payment.total)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card card--flush">
        <div className="toolbar">
          <h2>Productos más vendidos (30 días)</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="right">Cantidad</th>
              <th className="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.topProducts.map((product) => (
              <tr key={product.productId}>
                <td>{product.productName}</td>
                <td className="right">{formatNumber(product.quantity)}</td>
                <td className="right">{money(product.total)}</td>
              </tr>
            ))}
            {data.topProducts.length === 0 && (
              <tr>
                <td colSpan={3} className="muted center">
                  Aún no hay ventas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
