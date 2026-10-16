-- ------------------------------------------------------------------
-- Roles y bases de datos (se ejecuta como superusuario sobre "postgres").
-- Una base por microservicio: identity, catalog, sales.
--   market_owner -> dueño de los objetos, ejecuta migraciones.
--   market_app   -> usado por los microservicios, solo DML y sujeto a RLS.
-- Variables psql: :owner_password, :app_password
-- ------------------------------------------------------------------

SELECT format('CREATE ROLE market_owner LOGIN PASSWORD %L', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'market_owner') \gexec

SELECT format('CREATE ROLE market_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'market_app') \gexec

SELECT 'CREATE DATABASE market_identity OWNER market_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'market_identity') \gexec

SELECT 'CREATE DATABASE market_catalog OWNER market_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'market_catalog') \gexec

SELECT 'CREATE DATABASE market_sales OWNER market_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'market_sales') \gexec

GRANT CONNECT ON DATABASE market_identity, market_catalog, market_sales TO market_app;
