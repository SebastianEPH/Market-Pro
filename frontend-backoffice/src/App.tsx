import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import {
  AppShell,
  AuthGate,
  AuthProvider,
  EmptyState,
  LoginPage,
  ModuleRoute,
  NavItem,
  useAuth,
} from '@market-pro/frontend-common';
import { AuthScope, ModuleCode } from '@market-pro/shared';
import { CashSessionsPage } from './pages/CashSessionsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { RolesPage } from './pages/RolesPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

/** El menú se arma con los permisos efectivos: si se quita un módulo, desaparece. */
const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', module: ModuleCode.DASHBOARD },
  { to: '/products', label: 'Productos', icon: '📦', module: ModuleCode.PRODUCTS },
  { to: '/categories', label: 'Categorías', icon: '🏷️', module: ModuleCode.CATEGORIES },
  { to: '/inventory', label: 'Inventario', icon: '📋', module: ModuleCode.INVENTORY },
  { to: '/sales', label: 'Ventas', icon: '🧾', module: ModuleCode.SALES },
  { to: '/cash-sessions', label: 'Cajas', icon: '💵', module: ModuleCode.CASH_REGISTER },
  { to: '/users', label: 'Usuarios', icon: '👥', module: ModuleCode.USERS },
  { to: '/roles', label: 'Roles y permisos', icon: '🛡️', module: ModuleCode.ROLES },
  { to: '/settings', label: 'Configuración', icon: '⚙️', module: ModuleCode.SETTINGS },
];

/** Redirige a la primera sección a la que el usuario tiene acceso. */
function Home() {
  const { can } = useAuth();
  const first = NAV.find((item) => item.module && can(item.module));
  if (first) return <Navigate to={first.to} replace />;
  return <EmptyState icon="🔒" title="Sin módulos asignados" message="Pide al administrador de tu tienda que te asigne permisos." />;
}

function BackofficeRoutes() {
  return (
    <AppShell brand="Market Pro" subtitle="Backoffice" nav={NAV}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<ModuleRoute module={ModuleCode.DASHBOARD}><DashboardPage /></ModuleRoute>} />
        <Route path="/products" element={<ModuleRoute module={ModuleCode.PRODUCTS}><ProductsPage /></ModuleRoute>} />
        <Route path="/categories" element={<ModuleRoute module={ModuleCode.CATEGORIES}><CategoriesPage /></ModuleRoute>} />
        <Route path="/inventory" element={<ModuleRoute module={ModuleCode.INVENTORY}><InventoryPage /></ModuleRoute>} />
        <Route path="/sales" element={<ModuleRoute module={ModuleCode.SALES}><SalesPage /></ModuleRoute>} />
        <Route path="/cash-sessions" element={<ModuleRoute module={ModuleCode.CASH_REGISTER}><CashSessionsPage /></ModuleRoute>} />
        <Route path="/users" element={<ModuleRoute module={ModuleCode.USERS}><UsersPage /></ModuleRoute>} />
        <Route path="/roles" element={<ModuleRoute module={ModuleCode.ROLES}><RolesPage /></ModuleRoute>} />
        <Route path="/settings" element={<ModuleRoute module={ModuleCode.SETTINGS}><SettingsPage /></ModuleRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider
        config={{
          apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
          storageKey: 'market-pro:backoffice-session',
          expectedScope: AuthScope.TENANT,
        }}
      >
        <AuthGate login={<LoginPage title="Market Pro" subtitle="Backoffice de la tienda" askTenant />}>
          <BackofficeRoutes />
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
