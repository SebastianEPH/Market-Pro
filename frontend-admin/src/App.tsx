import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell, AuthGate, AuthProvider, LoginPage, NavItem } from '@market-pro/frontend-common';
import { AuthScope } from '@market-pro/shared';
import { ModulesPage } from './pages/ModulesPage';
import { TenantCreatePage } from './pages/TenantCreatePage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { TenantsPage } from './pages/TenantsPage';

const NAV: NavItem[] = [
  { to: '/', label: 'Tiendas', icon: '🏪' },
  { to: '/tenants/new', label: 'Nueva tienda', icon: '➕' },
  { to: '/modules', label: 'Módulos globales', icon: '🧩' },
];

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider
        config={{
          apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
          storageKey: 'market-pro:admin-session',
          expectedScope: AuthScope.PLATFORM,
        }}
      >
        <AuthGate login={<LoginPage title="Market Pro" subtitle="Administración de plataforma" askTenant={false} />}>
          <AppShell brand="Market Pro" subtitle="Plataforma" nav={NAV}>
            <Routes>
              <Route path="/" element={<TenantsPage />} />
              <Route path="/tenants/new" element={<TenantCreatePage />} />
              <Route path="/tenants/:id" element={<TenantDetailPage />} />
              <Route path="/modules" element={<ModulesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
