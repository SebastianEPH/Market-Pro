import { FormEvent, useState } from 'react';
import {
  Badge,
  Can,
  ErrorBanner,
  Field,
  Loader,
  PageHeader,
  Tone,
  formatDateTime,
  formatMoney,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import { CashSessionView, ModuleCode, PermissionAction } from '@market-pro/shared';
import { OpenCashForm } from '../components/OpenCashForm';

export function CashPage() {
  const api = useApi();
  const { access } = useAuth();
  const currency = access?.settings?.currency ?? 'PEN';
  const money = (value: number) => formatMoney(value, currency);
  const session = useAsync(() => api.get<CashSessionView | null>('/sales/cash-sessions/current'), []);
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [closed, setClosed] = useState<CashSessionView | null>(null);
  const [error, setError] = useState<unknown>(null);

  const close = async (event: FormEvent) => {
    event.preventDefault();
    if (!session.data) return;
    setError(null);
    try {
      const result = await api.post<CashSessionView>(`/sales/cash-sessions/${session.data.id}/close`, {
        closingAmount: Number(closingAmount),
        notes: notes || null,
      });
      setClosed(result);
      session.setData(null);
      setClosingAmount('');
      setNotes('');
    } catch (err) {
      setError(err);
    }
  };

  if (session.loading && !session.data) return <Loader />;

  return (
    <>
      <PageHeader title="Mi caja" />
      {closed && (
        <div className={`alert ${closed.difference === 0 ? 'alert--info' : 'alert--warning'}`}>
          Caja cerrada. Esperado {money(closed.expectedAmount ?? 0)} · Contado {money(closed.closingAmount ?? 0)} · Diferencia{' '}
          <strong>{money(closed.difference ?? 0)}</strong>
        </div>
      )}
      {!session.data ? (
        <OpenCashForm
          onOpened={(opened) => {
            setClosed(null);
            session.setData(opened);
          }}
        />
      ) : (
        <div className="grid grid--2">
          <div className="card stack">
            <div className="row row--between">
              <h2>Caja abierta</h2>
              <Badge tone={Tone.INFO}>Desde {formatDateTime(session.data.openedAt)}</Badge>
            </div>
            <div className="row row--between">
              <span className="muted">Monto inicial</span>
              <strong>{money(session.data.openingAmount)}</strong>
            </div>
            <div className="row row--between">
              <span className="muted">Ventas ({session.data.salesCount})</span>
              <strong>{money(session.data.salesTotal)}</strong>
            </div>
            <div className="row row--between">
              <span className="muted">Ventas en efectivo</span>
              <strong>{money(session.data.cashSalesTotal)}</strong>
            </div>
            <div className="row row--between">
              <span>Efectivo esperado</span>
              <strong>{money(session.data.openingAmount + session.data.cashSalesTotal)}</strong>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={session.reload}>
              ↻ Actualizar
            </button>
          </div>

          <Can module={ModuleCode.CASH_REGISTER} action={PermissionAction.UPDATE} fallback={<p className="muted">No tienes permiso para cerrar caja.</p>}>
            <form className="card stack" onSubmit={close}>
              <h2>Cerrar caja</h2>
              <ErrorBanner error={error} />
              <Field label="Efectivo contado">
                <input type="number" step="0.01" min="0" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} required />
              </Field>
              <Field label="Observaciones">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <button className="btn btn--primary">Cerrar caja</button>
            </form>
          </Can>
        </div>
      )}
    </>
  );
}
