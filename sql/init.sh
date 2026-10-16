#!/usr/bin/env bash
# ------------------------------------------------------------------
# Inicializa todas las bases de Market Pro.
#  - Docker: se ejecuta automáticamente (montado en /docker-entrypoint-initdb.d).
#  - Manual: PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./sql/init.sh
# Orden: 00_init (roles + bases) -> identity -> catalog -> sales.
# Cada script de servicio se ejecuta como market_owner (dueño de tablas);
# la aplicación se conecta como market_app (sujeto a Row Level Security).
# ------------------------------------------------------------------
set -eo pipefail

SQL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_USER="${POSTGRES_USER:-${PGUSER:-postgres}}"
OWNER_PASSWORD="${MARKET_OWNER_PASSWORD:-owner_dev_password}"
APP_PASSWORD="${MARKET_APP_PASSWORD:-app_dev_password}"

run_psql() {
  psql -v ON_ERROR_STOP=1 --no-psqlrc --username "$PG_USER" "$@"
}

echo "[market-pro] Creando roles y bases de datos..."
run_psql --dbname postgres \
  -v owner_password="$OWNER_PASSWORD" \
  -v app_password="$APP_PASSWORD" \
  -f "$SQL_DIR/00_init/001_roles_and_databases.sql"

for service in identity catalog sales; do
  for script in "$SQL_DIR/$service"/*.sql; do
    echo "[market-pro] $service -> $(basename "$script")"
    run_psql --dbname "market_$service" -c "SET ROLE market_owner" -f "$script"
  done
done

echo "[market-pro] Bases inicializadas."
