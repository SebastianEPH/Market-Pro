--liquibase formatted sql
--changeset market-pro:identity-003-seed-catalog splitStatements:false
-- ------------------------------------------------------------------
-- Semilla del catálogo global: módulos, permisos CRUD y features.
-- Los códigos deben coincidir con los enums ModuleCode / FeatureCode
-- de shared/src/enums/access.enums.ts
-- ------------------------------------------------------------------

INSERT INTO modules (code, name, description, icon, sort_order) VALUES
  ('dashboard',     'Dashboard',        'Indicadores y resumen de ventas',          'chart',    10),
  ('users',         'Usuarios',         'Usuarios de la tienda',                    'users',    20),
  ('roles',         'Roles y permisos', 'Roles y asignación de permisos',           'shield',   30),
  ('settings',      'Configuración',    'Moneda, impuestos y datos de la tienda',   'settings', 40),
  ('categories',    'Categorías',       'Categorías de productos',                  'tag',      50),
  ('products',      'Productos',        'Catálogo de productos y precios',          'box',      60),
  ('inventory',     'Inventario',       'Movimientos y ajustes de stock',           'stack',    70),
  ('pos',           'Punto de venta',   'Registro de ventas en caja',               'cart',     80),
  ('cash_register', 'Caja',             'Apertura y cierre de caja',                'cash',     90),
  ('sales',         'Ventas',           'Historial, detalle y anulación de ventas', 'receipt', 100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (module_code, action, code, description)
SELECT m.code,
       a.action,
       m.code || ':' || a.action::text,
       initcap(a.action::text) || ' - ' || m.name
FROM modules m
CROSS JOIN unnest(enum_range(NULL::permission_action)) AS a (action)
ON CONFLICT (code) DO NOTHING;

INSERT INTO features (code, module_code, name, description, value_type, default_enabled, default_limit) VALUES
  ('sales.discounts',          'pos',       'Descuentos en venta',     'Permite aplicar descuentos por ítem o globales en el POS', 'BOOLEAN', true,  NULL),
  ('sales.void',               'sales',     'Anulación de ventas',     'Permite anular ventas y devolver stock',                  'BOOLEAN', true,  NULL),
  ('inventory.negative_stock', 'inventory', 'Vender sin stock',        'Permite que el stock quede negativo al vender',           'BOOLEAN', false, NULL),
  ('users.max',                'users',     'Máximo de usuarios',      'Cantidad máxima de usuarios activos del tenant',          'NUMBER',  true,  5),
  ('products.max',             'products',  'Máximo de productos',     'Cantidad máxima de productos del tenant',                 'NUMBER',  true,  1000)
ON CONFLICT (code) DO NOTHING;
