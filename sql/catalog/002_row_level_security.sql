--liquibase formatted sql
--changeset market-pro:catalog-002-row-level-security splitStatements:false
-- ------------------------------------------------------------------
-- Row Level Security por tenant (market_catalog).
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories', 'products', 'stock_movements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = app_current_tenant())
         WITH CHECK (tenant_id = app_current_tenant())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO market_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO market_app;

-- La aplicación no debe poder alterar el historial de migraciones de Liquibase
REVOKE ALL ON TABLE databasechangelog, databasechangeloglock FROM market_app;
