import { FormEvent, useState } from 'react';
import { Can, EmptyState, ErrorBanner, Field, useApi } from '@market-pro/frontend-common';
import { CashSessionView, ModuleCode, PermissionAction } from '@market-pro/shared';

/** Formulario de apertura de caja (requerido antes de vender). */
export function OpenCashForm({ onOpened }: { onOpened(session: CashSessionView): void }) {
  const api = useApi();
  const [amount, setAmount] = useState('0');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onOpened(await api.post<CashSessionView>('/sales/cash-sessions/open', { openingAmount: Number(amount) }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can
      module={ModuleCode.CASH_REGISTER}
      action={PermissionAction.CREATE}
      fallback={<EmptyState icon="💵" title="Caja cerrada" message="No tienes permiso para abrir caja. Pide a un supervisor que la abra." />}
    >
      <form className="card stack" style={{ maxWidth: 420, margin: '40px auto' }} onSubmit={submit}>
        <h2>Abrir caja</h2>
        <p className="muted">Ingresa el efectivo con el que inicias el turno.</p>
        <ErrorBanner error={error} />
        <Field label="Monto inicial">
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <button className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </form>
    </Can>
  );
}
