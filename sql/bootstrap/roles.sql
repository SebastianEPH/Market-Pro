-- ------------------------------------------------------------------
-- Usuarios (roles) de PostgreSQL de Market Pro
--
-- Lo ejecuta `npm run db:setup` (scripts/db.mjs -> bootstrap) conectado como
-- SUPERUSUARIO (DATABASE_POSTGRESQL_ADMIN_USER, en local: postgres).
-- Es idempotente: si el rol ya existe solo sincroniza su contraseña con la
-- del archivo config/.env.<env>, así que se puede ejecutar las veces que sea.
--
-- Variables (las reemplaza db.mjs escapadas, misma sintaxis que psql -v):
--   :"owner_user"  :'owner_password'  -> DATABASE_POSTGRESQL_OWNER_USER / _PASSWORD
--   :"app_user"    :'app_password'    -> DATABASE_POSTGRESQL_USER / _PASSWORD
--
-- Resumen:
--   | Rol           | Quién lo usa              | Para qué                                   |
--   |---------------|---------------------------|--------------------------------------------|
--   | postgres      | db.mjs (bootstrap)        | Crear estos roles y las 3 bases. Nada más. |
--   | market_owner  | Liquibase (migraciones)   | Dueño de bases y tablas: DDL (CREATE/ALTER)|
--   | market_app    | Microservicios (backend)  | Solo DML, filtrado por Row Level Security  |
--
-- Los permisos de market_app sobre tablas, secuencias y funciones NO se dan
-- aquí: los otorgan las migraciones de cada servicio (sql/<servicio>/001_schema.sql
-- y 002_row_level_security.sql), porque las tablas se crean ahí.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- market_owner: DUEÑO del esquema
--   Quién:    Liquibase, al ejecutar `npm run db:migrate` / `npm run db:setup`.
--   Para qué: es el OWNER de market_identity, market_catalog y market_sales;
--             crea y modifica tablas, índices, funciones y políticas RLS.
--   No es superusuario ni puede crear bases ni roles. La aplicación NUNCA
--   se conecta con este rol (como dueño de las tablas se saltaría RLS).
-- ------------------------------------------------------------------
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'owner_user') THEN
    ALTER ROLE :"owner_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'owner_password';
    RAISE NOTICE 'rol % actualizado', :'owner_user';
  ELSE
    CREATE ROLE :"owner_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'owner_password';
    RAISE NOTICE 'rol % creado', :'owner_user';
  END IF;
END
$roles$;

-- ------------------------------------------------------------------
-- market_app: usuario de la APLICACIÓN
--   Quién:    los microservicios identity, catalog y sales (backend/core,
--             pool de pg), en local vía el gateway y en AWS desde cada Lambda.
--   Para qué: leer y escribir datos (SELECT/INSERT/UPDATE/DELETE) y nada más.
--             No es dueño de ninguna tabla, por eso Row Level Security le
--             aplica y solo ve las filas de su tenant.
--   No puede crear ni alterar tablas, ni bases, ni roles.
-- ------------------------------------------------------------------
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') THEN
    ALTER ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'app_password';
    RAISE NOTICE 'rol % actualizado', :'app_user';
  ELSE
    CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'app_password';
    RAISE NOTICE 'rol % creado', :'app_user';
  END IF;
END
$roles$;
