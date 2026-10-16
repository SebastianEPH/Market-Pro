import { FormEvent, useState } from 'react';
import {
  Badge,
  Can,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PageHeader,
  Pagination,
  Tone,
  UNIT_LABELS,
  formatMoney,
  formatNumber,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import { CategoryView, ModuleCode, PaginatedResult, PermissionAction, ProductUnit, ProductView } from '@market-pro/shared';

interface ProductForm {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  unit: ProductUnit;
  costPrice: string;
  salePrice: string;
  initialStock: string;
  minStock: string;
  isActive: boolean;
}

const EMPTY_FORM: ProductForm = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  categoryId: '',
  unit: ProductUnit.UNIT,
  costPrice: '0',
  salePrice: '',
  initialStock: '0',
  minStock: '0',
  isActive: true,
};

export function ProductsPage() {
  const api = useApi();
  const { access } = useAuth();
  const currency = access?.settings?.currency ?? 'PEN';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const products = useAsync(
    () =>
      api.get<PaginatedResult<ProductView>>('/catalog/products', {
        search,
        categoryId,
        lowStock: lowStock || undefined,
        page,
        pageSize: 20,
      }),
    [search, categoryId, lowStock, page],
  );
  const categories = useAsync(() => api.get<CategoryView[]>('/catalog/categories'), []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (product: ProductView) => {
    setEditing(product);
    setForm({
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      unit: product.unit,
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      initialStock: '0',
      minStock: String(product.minStock),
      isActive: product.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    const payload = {
      sku: form.sku,
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      categoryId: form.categoryId || null,
      unit: form.unit,
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      minStock: Number(form.minStock),
      isActive: form.isActive,
    };
    try {
      if (editing) await api.patch(`/catalog/products/${editing.id}`, payload);
      else await api.post('/catalog/products', { ...payload, initialStock: Number(form.initialStock) });
      setFormOpen(false);
      products.reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (product: ProductView) => {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await api.delete(`/catalog/products/${product.id}`);
      products.reload();
    } catch (err) {
      setFormError(err);
    }
  };

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeader
        title="Productos"
        actions={
          <Can module={ModuleCode.PRODUCTS} action={PermissionAction.CREATE}>
            <button className="btn btn--primary" onClick={openCreate}>
              ➕ Nuevo producto
            </button>
          </Can>
        }
      />
      <ErrorBanner error={products.error ?? (!formOpen ? formError : null)} />
      <div className="card card--flush">
        <div className="toolbar">
          <input
            placeholder="Buscar por nombre, SKU o código de barras…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las categorías</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="row">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Stock bajo
          </label>
        </div>
        {products.loading && !products.data ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th className="right">Precio</th>
                  <th className="right">Stock</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.data?.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <div className="muted mono">{product.barcode}</div>
                    </td>
                    <td className="mono">{product.sku}</td>
                    <td>{product.categoryName ?? '—'}</td>
                    <td className="right">{formatMoney(product.salePrice, currency)}</td>
                    <td className="right">
                      <Badge tone={product.stock <= product.minStock ? Tone.WARNING : Tone.NEUTRAL}>
                        {formatNumber(product.stock)} {product.unit === ProductUnit.UNIT ? '' : product.unit.toLowerCase()}
                      </Badge>
                    </td>
                    <td>{product.isActive ? <Badge tone={Tone.SUCCESS}>Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className="right">
                      <Can module={ModuleCode.PRODUCTS} action={PermissionAction.UPDATE}>
                        <button className="btn btn--ghost btn--sm" onClick={() => openEdit(product)}>
                          Editar
                        </button>
                      </Can>
                      <Can module={ModuleCode.PRODUCTS} action={PermissionAction.DELETE}>
                        <button className="btn btn--ghost btn--sm" onClick={() => void remove(product)}>
                          Eliminar
                        </button>
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {products.data && (
          <Pagination page={products.data.page} pageSize={products.data.pageSize} total={products.data.total} onChange={setPage} />
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setFormOpen(false)}
        wide
        footer={
          <button className="btn btn--primary" form="product-form" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        }
      >
        <form id="product-form" className="stack" onSubmit={save}>
          <ErrorBanner error={formError} />
          <div className="grid grid--2">
            <Field label="Nombre">
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label="Categoría">
              <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="SKU">
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} required />
            </Field>
            <Field label="Código de barras">
              <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
            </Field>
            <Field label="Unidad">
              <select value={form.unit} onChange={(e) => set('unit', e.target.value as ProductUnit)}>
                {Object.values(ProductUnit).map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Precio de venta">
              <input type="number" step="0.01" min="0" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} required />
            </Field>
            <Field label="Costo">
              <input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
            </Field>
            <Field label="Stock mínimo">
              <input type="number" step="0.001" min="0" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
            </Field>
            {!editing && (
              <Field label="Stock inicial" hint="Se registra como entrada de inventario">
                <input type="number" step="0.001" min="0" value={form.initialStock} onChange={(e) => set('initialStock', e.target.value)} />
              </Field>
            )}
          </div>
          <Field label="Descripción">
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <label className="row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Producto activo
          </label>
        </form>
      </Modal>
    </>
  );
}
