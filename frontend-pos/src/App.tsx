import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell, AuthGate, AuthProvider, LoginPage, ModuleRoute, NavItem } from '@market-pro/frontend-common';
import { AuthScope, ModuleCode, PermissionAction } from '@market-pro/shared';
import { CashPage } from './pages/CashPage';
import { MySalesPage } from './pages/MySalesPage';
import { PosPage } from './pages/PosPage';

const NAV: NavItem[] = [
  { to: '/', label: 'Vender', icon: '🛒', module: ModuleCode.POS, action: PermissionAction.CREATE },
  { to: '/sales', label: 'Mis ventas', icon: '🧾', module: ModuleCode.POS },
  { to: '/cash', label: 'Mi caja', icon: '💵', module: ModuleCode.CASH_REGISTER },
];

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider
        config={{
          apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
          storageKey: 'market-pro:pos-session',
          expectedScope: AuthScope.TENANT,
          accessPollMs: 20_000,
        }}
      >
        <AuthGate login={<LoginPage title="Punto de venta" subtitle="Market Pro" askTenant />}>
          <AppShell brand="Market Pro" subtitle="Punto de venta" nav={NAV}>
            <Routes>
              <Route
                path="/"
                element={
                  <ModuleRoute module={ModuleCode.POS} action={PermissionAction.CREATE}>
                    <PosPage />
                  </ModuleRoute>
                }
              />
              <Route
                path="/sales"
                element={
                  <ModuleRoute module={ModuleCode.POS}>
                    <MySalesPage />
                  </ModuleRoute>
                }
              />
              <Route
                path="/cash"
                element={
                  <ModuleRoute module={ModuleCode.CASH_REGISTER}>
                    <CashPage />
                  </ModuleRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
