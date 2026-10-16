-- ------------------------------------------------------------------
-- market_identity: tenants (compradores), usuarios, roles, módulos,
-- permisos y características (features).
-- Requiere PostgreSQL 18+ (uuidv7() nativo).
-- ------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO market_app;
ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO market_app;
GRANT USAGE ON SCHEMA public TO market_app;

CREATE TYPE tenant_status      AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE user_status        AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
CREATE TYPE permission_action  AS ENUM ('create', 'read', 'update', 'delete');
CREATE TYPE permission_effect  AS ENUM ('ALLOW', 'DENY');
CREATE TYPE feature_value_type AS ENUM ('BOOLEAN', 'NUMBER');
CREATE TYPE auth_scope         AS ENUM ('platform', 'tenant');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------
-- Catálogo global (lo administra solo el administrador de plataforma)
-- ---------------------------------------------------------------

-- Módulos del sistema. Todo el código está siempre desplegado;
-- is_active es el interruptor global (apaga el módulo para TODOS).
CREATE TABLE modules (
  code        text PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  icon        text,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabla única de permisos: un registro por (módulo, acción CRUD).
-- code = '<modulo>:<accion>', ej. 'products:create'.
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  module_code text              NOT NULL REFERENCES modules (code) ON UPDATE CASCADE ON DELETE CASCADE,
  action      permission_action NOT NULL,
  code        text              NOT NULL UNIQUE,
  description text,
  created_at  timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (module_code, action)
);

-- Características configurables por tenant (on/off o con límite numérico).
CREATE TABLE features (
  code            text PRIMARY KEY,
  module_code     text               NOT NULL REFERENCES modules (code) ON UPDATE CASCADE ON DELETE CASCADE,
  name            text               NOT NULL,
  description     text,
  value_type      feature_value_type NOT NULL DEFAULT 'BOOLEAN',
  default_enabled boolean            NOT NULL DEFAULT false,
  default_limit   integer,
  created_at      timestamptz        NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Tenants (cada comprador del sistema = una instancia)
-- ---------------------------------------------------------------
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  slug          text          NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name          text          NOT NULL,
  legal_name    text,
  tax_id        text,
  contact_email text,
  contact_phone text,
  status        tenant_status NOT NULL DEFAULT 'ACTIVE',
  plan_name     text,
  settings      jsonb         NOT NULL DEFAULT jsonb_build_object(
                  'currency', 'PEN',
                  'taxRate', 0.18,
                  'taxIncluded', true,
                  'timezone', 'America/Lima',
                  'receiptFooter', null),
  expires_at    timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Módulos habilitados para el tenant (interruptor en tiempo real).
CREATE TABLE tenant_modules (
  tenant_id   uuid        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  module_code text        NOT NULL REFERENCES modules (code) ON UPDATE CASCADE ON DELETE CASCADE,
  is_enabled  boolean     NOT NULL DEFAULT true,
  expires_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_code)
);
CREATE TRIGGER trg_tenant_modules_updated_at BEFORE UPDATE ON tenant_modules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "Techo" de permisos del tenant: qué acciones CRUD de cada módulo puede
-- usar el comprador. Sus usuarios nunca pueden superar este techo.
CREATE TABLE tenant_permissions (
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, permission_id)
);

CREATE TABLE tenant_features (
  tenant_id    uuid        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  feature_code text        NOT NULL REFERENCES features (code) ON UPDATE CASCADE ON DELETE CASCADE,
  is_enabled   boolean     NOT NULL,
  limit_value  integer,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_code)
);
CREATE TRIGGER trg_tenant_features_updated_at BEFORE UPDATE ON tenant_features FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------

-- Administradores globales de la plataforma (creador / vendedor del sistema).
CREATE TABLE platform_users (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  full_name     text        NOT NULL,
  status        user_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_platform_users_email ON platform_users (lower(email));
CREATE TRIGGER trg_platform_users_updated_at BEFORE UPDATE ON platform_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Usuarios de cada tenant. is_owner = administrador del comprador
-- (obtiene automáticamente todo el techo de permisos del tenant).
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email           text        NOT NULL,
  password_hash   text        NOT NULL,
  full_name       text        NOT NULL,
  document_number text,
  phone           text,
  status          user_status NOT NULL DEFAULT 'ACTIVE',
  is_owner        boolean     NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_tenant_email ON users (tenant_id, lower(email));
CREATE UNIQUE INDEX ux_users_one_owner ON users (tenant_id) WHERE is_owner;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE role_permissions (
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id   uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX ix_user_roles_role ON user_roles (role_id);

-- Permisos directos por usuario: ALLOW concede, DENY quita (gana sobre roles).
CREATE TABLE user_permissions (
  tenant_id     uuid              NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id       uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  permission_id uuid              NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  effect        permission_effect NOT NULL DEFAULT 'ALLOW',
  PRIMARY KEY (user_id, permission_id)
);

-- Refresh tokens (se guarda solo el hash SHA-256; rotación en cada uso).
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  scope       auth_scope  NOT NULL,
  subject_id  uuid        NOT NULL,
  tenant_id   uuid REFERENCES tenants (id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid,
  user_agent  text,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_subject ON refresh_tokens (subject_id);
