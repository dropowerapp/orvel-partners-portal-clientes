#!/usr/bin/env bash
# Recria a base de dados local "portal" num Postgres simples (sem Docker):
# réplica do ambiente Supabase + migrações + seed. Equivalente a `supabase db reset`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGHOST="${PGHOST:-/var/tmp/pg}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}"
DB="${PGDATABASE_LOCAL:-portal}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

psql -X -q -d postgres -c "drop database if exists $DB with (force);" -c "create database $DB;"
psql -X -q -d "$DB" -c "alter database $DB set search_path = \"\$user\", public, extensions;"
"${PSQL[@]}" -f "$ROOT/scripts/local/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
if [[ "${1:-}" != "--no-seed" && -f "$ROOT/supabase/seed.sql" ]]; then
  echo "→ seed.sql"
  "${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
fi
echo "Base de dados local '$DB' pronta."
