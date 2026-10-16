import { ReactNode } from 'react';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { EmptyState, Loader } from '../ui/components';
import { useAuth } from './AuthProvider';

/** Muestra `login` si no hay sesión; los hijos si la hay. */
export function AuthGate({ login, children }: { login: ReactNode; children: ReactNode }) {
  const { ready, user, access } = useAuth();
  if (!ready) return <Loader fullscreen />;
  if (!user) return <>{login}</>;
  if (!access) return <Loader fullscreen />;
  return <>{children}</>;
}

/** Renderiza hijos solo si el usuario tiene el permiso (módulo + acción). */
export function Can({
  module,
  action = PermissionAction.READ,
  fallback = null,
  children,
}: {
  module: ModuleCode;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(module, action) ? children : fallback}</>;
}

/**
 * Protege una página completa. Si el módulo se desactiva en tiempo real
 * mientras el usuario está dentro, la página se reemplaza por un aviso.
 */
export function ModuleRoute({
  module,
  action = PermissionAction.READ,
  children,
}: {
  module: ModuleCode;
  action?: PermissionAction;
  children: ReactNode;
}) {
  const { can, access } = useAuth();
  if (can(module, action)) return <>{children}</>;
  const disabled = access ? !access.enabledModules.includes(module) : true;
  return (
    <EmptyState
      icon="🔒"
      title={disabled ? 'Módulo no disponible' : 'Sin permiso'}
      message={
        disabled
          ? 'Este módulo no está habilitado para tu tienda. Contacta a tu proveedor.'
          : 'No tienes permiso para ver esta sección. Pide acceso al administrador.'
      }
    />
  );
}
