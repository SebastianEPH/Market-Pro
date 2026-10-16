--liquibase formatted sql
--changeset market-pro:identity-002-row-level-security splitStatements:false
-- ------------------------------------------------------------------
-- Row Level Security: aislamiento por tenant.
-- La aplicación abre cada transacción con:
--   SELECT set_config('app.tenant_id', '<uuid>', true), set_config('app.scope', 'tenant', true)
-- o, para operaciones del administrador de plataforma:
--   SELECT set_config('app.scope', 'platform', true)
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.scope', true), '') = 'platform'
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_modules', 'tenant_permissions', 'tenant_features',
    'users', 'roles', 'role_permissions', 'user_roles', 'user_permissions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (app_is_platform() OR tenant_id = app_current_tenant())
         WITH CHECK (app_is_platform() OR tenant_id = app_current_tenant())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO market_app;
GRANT EXECUTE ON FUNCTION app_current_tenant(), app_is_platform() TO market_app;

-- La aplicación no debe poder alterar el historial de migraciones de Liquibase
REVOKE ALL ON TABLE databasechangelog, databasechangeloglock FROM market_app;
