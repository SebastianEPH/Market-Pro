import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { useAuth } from '../auth/AuthProvider';

export interface NavItem {
  to: string;
  label: string;
  icon?: string;
  /** Si se indica, el enlace solo aparece con ese permiso (en tiempo real). */
  module?: ModuleCode;
  action?: PermissionAction;
}

export function AppShell({ brand, subtitle, nav, children }: { brand: string; subtitle?: string; nav: NavItem[]; children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const visible = nav.filter((item) => !item.module || can(item.module, item.action ?? PermissionAction.READ));

  return (
    <div className={`shell ${open ? 'shell--nav-open' : ''}`}>
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <span className="shell__logo" aria-hidden="true">
            ▣
          </span>
          <div>
            <strong>{brand}</strong>
            {subtitle && <small>{subtitle}</small>}
          </div>
        </div>
        <nav className="shell__nav" onClick={() => setOpen(false)}>
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span aria-hidden="true">{item.icon ?? '•'}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="shell__user">
          <div>
            <strong>{user?.fullName}</strong>
            <small>{user?.tenant?.name ?? user?.email}</small>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
            Salir
          </button>
        </div>
      </aside>
      <div className="shell__main">
        <div className="shell__topbar">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setOpen((value) => !value)} aria-label="Menú">
            ☰
          </button>
          <strong>{brand}</strong>
        </div>
        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}
