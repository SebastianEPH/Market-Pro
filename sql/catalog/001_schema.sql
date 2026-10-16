--liquibase formatted sql
--changeset market-pro:catalog-001-schema splitStatements:false
-- ------------------------------------------------------------------
-- market_catalog: categorías, productos y movimientos de stock.
-- ------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO market_app;
ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO market_app;
GRANT USAGE ON SCHEMA public TO market_app;

CREATE TYPE product_unit        AS ENUM ('UNIT', 'KG', 'LT', 'BOX', 'PACK');
CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'SALE', 'SALE_VOID');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL,
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_categories_tenant_name ON categories (tenant_id, lower(name));
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid           NOT NULL,
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  sku         text           NOT NULL,
  barcode     text,
  name        text           NOT NULL,
  description text,
  unit        product_unit   NOT NULL DEFAULT 'UNIT',
  cost_price  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price  numeric(12, 2) NOT NULL CHECK (sale_price >= 0),
  stock       numeric(12, 3) NOT NULL DEFAULT 0,
  min_stock   numeric(12, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  is_active   boolean        NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_products_tenant_sku     ON products (tenant_id, lower(sku)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_products_tenant_barcode ON products (tenant_id, barcode)    WHERE deleted_at IS NULL AND barcode IS NOT NULL;
CREATE INDEX ix_products_tenant_name           ON products (tenant_id, lower(name));
CREATE INDEX ix_products_tenant_category       ON products (tenant_id, category_id);
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- quantity con signo: positivo = entrada, negativo = salida.
-- (reference_type, reference_id) hace idempotente la aplicación de stock
-- desde otros microservicios (ej. una venta se descuenta una sola vez).
CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid                NOT NULL,
  product_id     uuid                NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  type           stock_movement_type NOT NULL,
  quantity       numeric(12, 3)      NOT NULL,
  stock_after    numeric(12, 3),
  reference_type text,
  reference_id   uuid,
  note           text,
  created_by     uuid,
  created_at     timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX ix_stock_movements_product ON stock_movements (tenant_id, product_id, created_at DESC);
CREATE UNIQUE INDEX ux_stock_movements_reference
  ON stock_movements (tenant_id, reference_type, reference_id, product_id)
  WHERE reference_id IS NOT NULL;
