--liquibase formatted sql
--changeset market-pro:sales-001-schema splitStatements:false
-- ------------------------------------------------------------------
-- market_sales: caja, ventas y numeración por tenant.
-- product_id / seller_id son referencias lógicas a otros microservicios
-- (no hay FK entre bases distintas).
-- ------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO market_app;
ALTER DEFAULT PRIVILEGES FOR ROLE market_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO market_app;
GRANT USAGE ON SCHEMA public TO market_app;

CREATE TYPE cash_session_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE sale_status         AS ENUM ('COMPLETED', 'VOIDED');
CREATE TYPE payment_method      AS ENUM ('CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET');

CREATE TABLE tenant_counters (
  tenant_id uuid   NOT NULL,
  name      text   NOT NULL,
  value     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, name)
);

CREATE TABLE cash_sessions (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid                NOT NULL,
  opened_by       uuid                NOT NULL,
  opened_by_name  text                NOT NULL,
  opening_amount  numeric(12, 2)      NOT NULL CHECK (opening_amount >= 0),
  opened_at       timestamptz         NOT NULL DEFAULT now(),
  closed_by       uuid,
  closing_amount  numeric(12, 2),
  expected_amount numeric(12, 2),
  difference      numeric(12, 2),
  closed_at       timestamptz,
  status          cash_session_status NOT NULL DEFAULT 'OPEN',
  notes           text
);
-- Un usuario solo puede tener una caja abierta
CREATE UNIQUE INDEX ux_cash_sessions_open_per_user ON cash_sessions (tenant_id, opened_by) WHERE status = 'OPEN';
CREATE INDEX ix_cash_sessions_tenant ON cash_sessions (tenant_id, opened_at DESC);

CREATE TABLE sales (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid           NOT NULL,
  number            bigint         NOT NULL,
  cash_session_id   uuid           NOT NULL REFERENCES cash_sessions (id),
  seller_id         uuid           NOT NULL,
  seller_name       text           NOT NULL,
  customer_name     text,
  customer_document text,
  currency          text           NOT NULL,
  subtotal          numeric(12, 2) NOT NULL,
  discount_total    numeric(12, 2) NOT NULL DEFAULT 0,
  tax_total         numeric(12, 2) NOT NULL DEFAULT 0,
  total             numeric(12, 2) NOT NULL,
  payment_method    payment_method NOT NULL,
  amount_paid       numeric(12, 2) NOT NULL,
  change_amount     numeric(12, 2) NOT NULL DEFAULT 0,
  status            sale_status    NOT NULL DEFAULT 'COMPLETED',
  void_reason       text,
  voided_by         uuid,
  voided_at         timestamptz,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX ix_sales_tenant_created ON sales (tenant_id, created_at DESC);
CREATE INDEX ix_sales_session ON sales (cash_session_id);
CREATE INDEX ix_sales_seller ON sales (tenant_id, seller_id, created_at DESC);

CREATE TABLE sale_items (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid           NOT NULL,
  sale_id      uuid           NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  product_id   uuid           NOT NULL,
  sku          text           NOT NULL,
  product_name text           NOT NULL,
  quantity     numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price   numeric(12, 2) NOT NULL,
  discount     numeric(12, 2) NOT NULL DEFAULT 0,
  line_total   numeric(12, 2) NOT NULL
);
CREATE INDEX ix_sale_items_sale ON sale_items (sale_id);
CREATE INDEX ix_sale_items_product ON sale_items (tenant_id, product_id);
