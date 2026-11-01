#!/usr/bin/env bash
# Aplica as migrações de supabase/migrations/ que ainda faltam no projeto, por ordem, pela
# Management API. Equivalente a `supabase db push`, sem ligação direta ao Postgres.
#
# Cada migração corre num só pedido (uma transação: ou entra toda, ou nada) e fica registada em
# supabase_migrations.schema_migrations, a mesma tabela que o supabase CLI usa. Assim, mais
# tarde, `supabase db push` reconhece o que já foi aplicado.
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/db-push.sh [--dry-run]
source "$(dirname "$0")/_lib.sh"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

echo "Projeto $REF: $(sql "select current_user as role, current_setting('server_version') as postgres" | jq -c '.[0]')"

# Os objetos ficam do papel postgres, como com o supabase CLI (mesmo que a API use outro papel).
ROLE_PREFIX=""
if [[ "$(sql "select current_user <> 'postgres' as other" | jq -r '.[0].other')" == "true" ]]; then
  ROLE_PREFIX="set local role postgres;"
fi

sql "create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;" >/dev/null

applied="$(sql "select coalesce(json_agg(version order by version), '[]') as v from supabase_migrations.schema_migrations" | jq -r '.[0].v | if type == "string" then fromjson else . end | .[]')"

pending=0
for file in "$ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  if grep -qx "$version" <<<"$applied"; then
    echo "  já aplicada  $base"
    continue
  fi
  pending=$((pending + 1))
  if $DRY_RUN; then
    echo "  por aplicar  $base"
    continue
  fi
  echo "→ a aplicar   $base"
  body="$ROLE_PREFIX
$(cat "$file")
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values ($(sql_quote "$version"), $(sql_quote "$name"), array[$(sql_quote "$(cat "$file")")]);"
  sql "$body" >/dev/null
done

if [[ $pending -eq 0 ]]; then
  echo "Nada a aplicar: a base de dados está em dia."
elif $DRY_RUN; then
  echo "$pending migração(ões) por aplicar (--dry-run: nada foi alterado)."
else
  echo "$pending migração(ões) aplicada(s)."
fi
