#!/usr/bin/env bash
# Corre os testes pgTAP de supabase/tests na base de dados local. Equivalente a `supabase test db`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGHOST="${PGHOST:-/var/tmp/pg}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}"
DB="${PGDATABASE_LOCAL:-portal}"
pg_prove -d "$DB" --ext .sql "${@:-$ROOT/supabase/tests/}"
