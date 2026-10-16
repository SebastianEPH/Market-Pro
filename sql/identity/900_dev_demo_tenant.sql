-- ------------------------------------------------------------------
-- SOLO DESARROLLO: tenant de demostración "demo".
--   Login backoffice/POS -> tienda: demo | email: owner@demo.local | password: Admin123*
-- Eliminar este archivo (y sql/catalog/900_*) para producción.
-- ------------------------------------------------------------------
SELECT set_config('app.scope', 'platform', false);

INSERT INTO tenants (id, slug, name, legal_name, tax_id, contact_email, plan_name)
VALUES ('01960000-0000-7000-8000-000000000001', 'demo', 'Minimarket Demo', 'Minimarket Demo S.A.C.', '20123456789', 'owner@demo.local', 'PRO')
ON CONFLICT (id) DO NOTHING;

-- Todos los módulos y todas las acciones habilitadas
INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
SELECT '01960000-0000-7000-8000-000000000001', code, true FROM modules
ON CONFLICT DO NOTHING;

INSERT INTO tenant_permissions (tenant_id, permission_id)
SELECT '01960000-0000-7000-8000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, full_name, is_owner)
VALUES (
  '01960000-0000-7000-8000-0000000000a1',
  '01960000-0000-7000-8000-000000000001',
  'owner@demo.local',
  'scrypt$16384$8$1$FcRgG7epnhcU-wuqln5wkg$UiK1TN9VxhwxwIklnkwLypXbIQus8FTS3sA5PRVNXM9oN3u8FfoYzTnV7OwpjXSf5mParHsKbnBuz9dDrobgnA',
  'Dueño Demo',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Rol "Cajero" con permisos de POS y caja
INSERT INTO roles (id, tenant_id, name, description)
VALUES ('01960000-0000-7000-8000-0000000000b1', '01960000-0000-7000-8000-000000000001', 'Cajero', 'Vende en el POS y maneja su caja')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT '01960000-0000-7000-8000-000000000001', '01960000-0000-7000-8000-0000000000b1', id
FROM permissions
WHERE code IN ('pos:create', 'pos:read', 'cash_register:create', 'cash_register:read', 'cash_register:update', 'products:read', 'categories:read')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, full_name)
VALUES (
  '01960000-0000-7000-8000-0000000000a2',
  '01960000-0000-7000-8000-000000000001',
  'cajero@demo.local',
  'scrypt$16384$8$1$FcRgG7epnhcU-wuqln5wkg$UiK1TN9VxhwxwIklnkwLypXbIQus8FTS3sA5PRVNXM9oN3u8FfoYzTnV7OwpjXSf5mParHsKbnBuz9dDrobgnA',
  'Cajero Demo'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (tenant_id, user_id, role_id)
VALUES ('01960000-0000-7000-8000-000000000001', '01960000-0000-7000-8000-0000000000a2', '01960000-0000-7000-8000-0000000000b1')
ON CONFLICT DO NOTHING;
