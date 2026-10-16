import { FormEvent, useState } from 'react';
import { Badge, Can, ErrorBanner, Field, Loader, Modal, PageHeader, Tone, useApi, useAsync } from '@market-pro/frontend-common';
import { CategoryView, ModuleCode, PermissionAction } from '@market-pro/shared';

export function CategoriesPage() {
  const api = useApi();
  const categories = useAsync(() => api.get<CategoryView[]>('/catalog/categories'), []);
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const openForm = (category: CategoryView | null) => {
    setEditing(category);
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setIsActive(category?.isActive ?? true);
    setError(null);
    setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { name, description: description || null, isActive };
      if (editing) await api.patch(`/catalog/categories/${editing.id}`, payload);
      else await api.post('/catalog/categories', payload);
      setOpen(false);
      categories.reload();
    } catch (err) {
      setError(err);
    }
  };

  const remove = async (category: CategoryView) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"? Sus productos quedarán sin categoría.`)) return;
    try {
      await api.delete(`/catalog/categories/${category.id}`);
      categories.reload();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Categorías"
        actions={
          <Can module={ModuleCode.CATEGORIES} action={PermissionAction.CREATE}>
            <button className="btn btn--primary" onClick={() => openForm(null)}>
              ➕ Nueva categoría
            </button>
          </Can>
        }
      />
      <ErrorBanner error={categories.error ?? (!open ? error : null)} />
      {categories.loading && !categories.data ? (
        <Loader />
      ) : (
        <div className="card card--flush">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th className="right">Productos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.data?.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td className="muted">{category.description ?? '—'}</td>
                  <td className="right">{category.productCount}</td>
                  <td>{category.isActive ? <Badge tone={Tone.SUCCESS}>Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                  <td className="right">
                    <Can module={ModuleCode.CATEGORIES} action={PermissionAction.UPDATE}>
                      <button className="btn btn--ghost btn--sm" onClick={() => openForm(category)}>
                        Editar
                      </button>
                    </Can>
                    <Can module={ModuleCode.CATEGORIES} action={PermissionAction.DELETE}>
                      <button className="btn btn--ghost btn--sm" onClick={() => void remove(category)}>
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

      <Modal
        open={open}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        onClose={() => setOpen(false)}
        footer={
          <button className="btn btn--primary" form="category-form">
            Guardar
          </button>
        }
      >
        <form id="category-form" className="stack" onSubmit={save}>
          <ErrorBanner error={error} />
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Descripción">
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <label className="row">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Activa
          </label>
        </form>
      </Modal>
    </>
  );
}
