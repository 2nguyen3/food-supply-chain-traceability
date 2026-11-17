#!/bin/bash
# Chạy MỘT LẦN khi volume Postgres còn trống (cơ chế docker-entrypoint-initdb.d).
# Tạo mỗi môi trường cục bộ một database và một role riêng; role này là chủ database của nó
# và không vào được database của môi trường kia (CONNECT bị thu hồi khỏi PUBLIC).
# Muốn chạy lại: docker compose down -v (xóa luôn dữ liệu) rồi docker compose up -d db.
set -euo pipefail

create_env_db() {
  local db="$1" user="$2" password="$3"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
       -v db="$db" -v usr="$user" -v pw="$password" <<'EOSQL'
CREATE ROLE :"usr" LOGIN PASSWORD :'pw';
CREATE DATABASE :"db" OWNER :"usr";
REVOKE CONNECT ON DATABASE :"db" FROM PUBLIC;
EOSQL
}

create_env_db "$DEV_DB_NAME"  "$DEV_DB_USER"  "$DEV_DB_PASSWORD"
create_env_db "$TEST_DB_NAME" "$TEST_DB_USER" "$TEST_DB_PASSWORD"
