import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PAYMENT_LABELS,
  formatMoney,
  formatNumber,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import {
  CashSessionView,
  CreateSaleRequest,
  FeatureCode,
  PaginatedResult,
  PaymentMethod,
  ProductUnit,
  ProductView,
  SaleView,
} from '@market-pro/shared';
import { OpenCashForm } from '../components/OpenCashForm';
import { Receipt } from '../components/Receipt';

interface CartLine {
  product: ProductView;
  quantity: number;
  discount: number;
}

const toCents = (value: number) => Math.round(value * 100);

export function PosPage() {
  const api = useApi();
  const { access, user, feature } = useAuth();
  const settings = access?.settings;
  const currency = settings?.currency ?? 'PEN';
  const money = (value: number) => formatMoney(value, currency);
  const discountsEnabled = feature(FeatureCode.SALES_DISCOUNTS);

  const session = useAsync(() => api.get<CashSessionView | null>('/sales/cash-sessions/current'), []);
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const results = useAsync(
    () => api.get<PaginatedResult<ProductView>>('/catalog/products', { search: query, active: true, pageSize: 24 }),
    [query],
  );

  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<SaleView | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Vista previa de totales (el backend recalcula con precios vigentes)
  const totals = useMemo(() => {
    const linesCents = cart.reduce(
      (sum, line) => sum + Math.round(toCents(line.product.salePrice) * line.quantity) - toCents(line.discount),
      0,
    );
    const netCents = Math.max(0, linesCents - toCents(Number(globalDiscount) || 0));
    const rate = settings?.taxRate ?? 0.18;
    const included = settings?.taxIncluded ?? true;
    const taxCents = included ? Math.round(netCents - netCents / (1 + rate)) : Math.round(netCents * rate);
    const totalCents = included ? netCents : netCents + taxCents;
    return { tax: taxCents / 100, total: totalCents / 100, subtotal: (totalCents - taxCents) / 100 };
  }, [cart, globalDiscount, settings]);

  const paid = payment === PaymentMethod.CASH ? Number(amountPaid) || 0 : totals.total;
  const change = Math.max(0, paid - totals.total);

  const addProduct = (product: ProductView) => {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { product, quantity: 1, discount: 0 }];
    });
    setTerm('');
    searchRef.current?.focus();
  };

  const updateLine = (productId: string, patch: Partial<CartLine>) =>
    setCart((current) => current.map((line) => (line.product.id === productId ? { ...line, ...patch } : line)));

  const removeLine = (productId: string) => setCart((current) => current.filter((line) => line.product.id !== productId));

  /** Enter en el buscador: primero intenta código de barras / SKU exacto (lector). */
  const onSearchKey = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !term.trim()) return;
    event.preventDefault();
    try {
      addProduct(await api.get<ProductView>(`/catalog/products/by-code/${encodeURIComponent(term.trim())}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setQuery(term.trim());
      else setError(err);
    }
  };

  const checkout = async (event: FormEvent) => {
    event.preventDefault();
    if (cart.length === 0) return;
    setBusy(true);
    setError(null);
    const request: CreateSaleRequest = {
      items: cart.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        discount: discountsEnabled && line.discount > 0 ? line.discount : undefined,
      })),
      paymentMethod: payment,
      amountPaid: payment === PaymentMethod.CASH ? paid : undefined,
      globalDiscount: discountsEnabled && Number(globalDiscount) > 0 ? Number(globalDiscount) : undefined,
      customerName: customerName || null,
    };
    try {
      const sale = await api.post<SaleView>('/sales/sales', request);
      setReceipt(sale);
      setCart([]);
      setAmountPaid('');
      setCustomerName('');
      setGlobalDiscount('0');
      results.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (session.loading && !session.data) return <Loader />;
  if (!session.data) return <OpenCashForm onOpened={(opened) => session.setData(opened)} />;

  return (
    <>
      <div className="pos">
        <section className="stack">
          <input
            ref={searchRef}
            className="pos__search"
            placeholder="Escanea o escribe código / nombre y presiona Enter…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => void onSearchKey(e)}
            autoFocus
          />
          <div className="row">
            <button className="btn btn--sm" onClick={() => setQuery(term.trim())}>
              Buscar
            </button>
            {query && (
              <button className="btn btn--ghost btn--sm" onClick={() => setQuery('')}>
                Limpiar búsqueda «{query}»
              </button>
            )}
          </div>
          <ErrorBanner error={results.error} />
          <div className="pos__products">
            {results.data?.items.map((product) => (
              <button key={product.id} className="btn pos__product" onClick={() => addProduct(product)}>
                <span>{product.name}</span>
                <small>
                  {product.sku} · stock {formatNumber(product.stock)}
                </small>
                <strong>{money(product.salePrice)}</strong>
              </button>
            ))}
          </div>
        </section>

        <form className="card pos__cart" onSubmit={checkout}>
          <div className="row row--between">
            <h2>Venta actual</h2>
            <span className="muted">{user?.fullName}</span>
          </div>
          <ErrorBanner error={error} />
          <div className="pos__lines">
            {cart.length === 0 && <p className="muted center">Agrega productos para empezar</p>}
            {cart.map((line) => (
              <div key={line.product.id} className="pos__line">
                <div>
                  <strong>{line.product.name}</strong>
                  <div className="muted">{money(line.product.salePrice)} c/u</div>
                </div>
                <strong>{money(Math.round(toCents(line.product.salePrice) * line.quantity) / 100 - line.discount)}</strong>
                <div className="pos__qty">
                  <button type="button" className="btn btn--sm" onClick={() => updateLine(line.product.id, { quantity: Math.max(line.product.unit === ProductUnit.UNIT ? 1 : 0.001, line.quantity - 1) })}>
                    −
                  </button>
                  <input
                    type="number"
                    min={line.product.unit === ProductUnit.UNIT ? 1 : 0.001}
                    step={line.product.unit === ProductUnit.UNIT ? 1 : 0.001}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.product.id, { quantity: Number(e.target.value) || 0 })}
                  />
                  <button type="button" className="btn btn--sm" onClick={() => updateLine(line.product.id, { quantity: line.quantity + 1 })}>
                    +
                  </button>
                </div>
                <div className="pos__qty" style={{ justifyContent: 'flex-end' }}>
                  {discountsEnabled && (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      title="Descuento"
                      placeholder="Desc."
                      value={line.discount || ''}
                      onChange={(e) => updateLine(line.product.id, { discount: Number(e.target.value) || 0 })}
                    />
                  )}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeLine(line.product.id)} aria-label="Quitar">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {discountsEnabled && (
            <Field label="Descuento global">
              <input type="number" min={0} step="0.01" value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} />
            </Field>
          )}
          <Field label="Cliente (opcional)">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Field>

          <div className="pos__payments">
            {Object.values(PaymentMethod).map((method) => (
              <button
                type="button"
                key={method}
                className={`btn ${payment === method ? 'btn--active' : ''}`}
                onClick={() => setPayment(method)}
              >
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>
          {payment === PaymentMethod.CASH && (
            <Field label="Recibido">
              <input type="number" min={0} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={totals.total.toFixed(2)} />
            </Field>
          )}

          <div className="pos__totals">
            <div className="row row--between">
              <span className="muted">Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="row row--between">
              <span className="muted">Impuesto</span>
              <span>{money(totals.tax)}</span>
            </div>
            <div className="row row--between">
              <span>Total</span>
              <span className="pos__total">{money(totals.total)}</span>
            </div>
            {payment === PaymentMethod.CASH && change > 0 && (
              <div className="row row--between">
                <span>Vuelto</span>
                <strong>{money(change)}</strong>
              </div>
            )}
          </div>

          <button
            className="btn btn--primary btn--lg btn--block"
            disabled={busy || cart.length === 0 || (payment === PaymentMethod.CASH && amountPaid !== '' && paid < totals.total)}
          >
            {busy ? 'Registrando…' : `Cobrar ${money(totals.total)}`}
          </button>
        </form>
      </div>

      <Modal
        open={receipt !== null}
        title="Venta registrada"
        onClose={() => setReceipt(null)}
        footer={
          <>
            <button className="btn" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
            <button className="btn btn--primary" onClick={() => setReceipt(null)} autoFocus>
              Nueva venta
            </button>
          </>
        }
      >
        {receipt && <Receipt sale={receipt} storeName={user?.tenant?.name ?? ''} footer={settings?.receiptFooter} />}
      </Modal>
    </>
  );
}
