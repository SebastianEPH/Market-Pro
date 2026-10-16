import { FormEvent, useState } from 'react';
import {
  Badge,
  Can,
  ErrorBanner,
  Field,
  Loader,
  MOVEMENT_LABELS,
  Modal,
  PageHeader,
  Pagination,
  Tone,
  formatDateTime,
  formatNumber,
  useApi,
  useAsync,
} from '@market-pro/frontend-common';
import {
  ModuleCode,
  PaginatedResult,
  PermissionAction,
  ProductView,
  StockMovementType,
  StockMovementView,
} from '@market-pro/shared';

enum AdjustmentType {
  IN = 'IN',
  OUT = 'OUT',
  COUNT = 'ADJUSTMENT',
}

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  [AdjustmentType.IN]: 'Entrada (compra / reposición)',
  [AdjustmentType.OUT]: 'Salida (merma / consumo)',
  [AdjustmentType.COUNT]: 'Conteo físico (fijar stock)',
};

export function InventoryPage() {
  const api = useApi();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const movements = useAsync(
    () => api.get<PaginatedResult<StockMovementView>>('/catalog/inventory/movements', { type, page, pageSize: 25 }),
    [type, page],
  );

  const [open, setOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const candidates = useAsync(
    () =>
      open
        ? api.get<PaginatedResult<ProductView>>('/catalog/products', { search: productSearch, pageSize: 10 })
        : Promise.resolve(null),
    [open, productSearch],
  );
  const [product, setProduct] = useState<ProductView | null>(null);
  const [adjustment, setAdjustment] = useState<AdjustmentType>(AdjustmentType.IN);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const openForm = () => {
    setProduct(null);
    setProductSearch('');
    setQuantity('');
    setNote('');
    setAdjustment(AdjustmentType.IN);
    setError(null);
    setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!product) return;
    try {
      await api.post('/catalog/inventory/adjustments', {
        productId: product.id,
        type: adjustment,
        quantity: Number(quantity),
        note: note || null,
      });
      setOpen(false);
      movements.reload();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Movimientos de stock"
        actions={
          <Can module={ModuleCode.INVENTORY} action={PermissionAction.CREATE}>
            <button className="btn btn--primary" onClick={openForm}>
              ➕ Registrar movimiento
            </button>
          </Can>
        }
      />
      <ErrorBanner error={movements.error} />
      <div className="card card--flush">
        <div className="toolbar">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los movimientos</option>
            {Object.values(StockMovementType).map((value) => (
              <option key={value} value={value}>
                {MOVEMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {movements.loading && !movements.data ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="right">Cantidad</th>
                  <th className="right">Stock final</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.data?.items.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDateTime(movement.createdAt)}</td>
                    <td>
                      {movement.productName} <span className="muted mono">{movement.sku}</span>
                    </td>
                    <td>
                      <Badge>{MOVEMENT_LABELS[movement.type]}</Badge>
                    </td>
                    <td className="right">
                      <Badge tone={movement.quantity >= 0 ? Tone.SUCCESS : Tone.DANGER}>
                        {movement.quantity > 0 ? '+' : ''}
                        {formatNumber(movement.quantity)}
                      </Badge>
                    </td>
                    <td className="right">{movement.stockAfter === null ? '—' : formatNumber(movement.stockAfter)}</td>
                    <td className="muted">{movement.note ?? (movement.referenceType ? `${movement.referenceType}` : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {movements.data && (
          <Pagination page={movements.data.page} pageSize={movements.data.pageSize} total={movements.data.total} onChange={setPage} />
        )}
      </div>

      <Modal
        open={open}
        title="Registrar movimiento"
        onClose={() => setOpen(false)}
        footer={
          <button className="btn btn--primary" form="adjust-form" disabled={!product}>
            Guardar
          </button>
        }
      >
        <form id="adjust-form" className="stack" onSubmit={save}>
          <ErrorBanner error={error} />
          {product ? (
            <div className="alert alert--info row row--between">
              <span>
                <strong>{product.name}</strong> · stock actual {formatNumber(product.stock)}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setProduct(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <Field label="Producto">
              <input placeholder="Buscar producto…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} autoFocus />
              <div className="stack" style={{ gap: 4 }}>
                {candidates.data?.items.map((item) => (
                  <button type="button" key={item.id} className="btn btn--ghost" style={{ justifyContent: 'space-between' }} onClick={() => setProduct(item)}>
                    <span>{item.name}</span>
                    <span className="muted">{formatNumber(item.stock)}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Tipo">
            <select value={adjustment} onChange={(e) => setAdjustment(e.target.value as AdjustmentType)}>
              {Object.values(AdjustmentType).map((value) => (
                <option key={value} value={value}>
                  {ADJUSTMENT_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={adjustment === AdjustmentType.COUNT ? 'Stock contado' : 'Cantidad'}>
            <input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
          <Field label="Nota">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: factura F001-123" />
          </Field>
        </form>
      </Modal>
    </>
  );
}
