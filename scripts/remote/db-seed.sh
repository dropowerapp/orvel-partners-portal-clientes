#!/usr/bin/env bash
# Carrega os dados FICTÍCIOS (supabase/seed.sql) num projeto Supabase de DESENVOLVIMENTO.
# Nunca correr em produção.
#
# Proteções: recusa se o projeto tiver utilizadores fora de @exemplo.test (sinal de que não é
# um projeto só com dados fictícios) e não repete se o seed já tiver sido carregado.
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/db-seed.sh --sim-e-desenvolvimento
source "$(dirname "$0")/_lib.sh"

if [[ "${1:-}" != "--sim-e-desenvolvimento" ]]; then
  echo "Confirme que $REF é um projeto de desenvolvimento: acrescente --sim-e-desenvolvimento" >&2
  exit 1
fi

state="$(sql "select
  (select count(*) from auth.users where email not ilike '%@exemplo.test')::int as outros_utilizadores,
  exists (select 1 from public.organizations where slug = 'exemplo') as ja_carregado,
  exists (select 1 from public.organizations where slug = 'orvel') as migracoes_ok" | jq -c '.[0]')"
echo "Estado: $state"

if [[ "$(jq -r '.migracoes_ok' <<<"$state")" != "true" ]]; then
  echo "A organização Orvel não existe: aplique primeiro as migrações (scripts/remote/db-push.sh)." >&2
  exit 1
fi
if [[ "$(jq -r '.outros_utilizadores' <<<"$state")" != "0" ]]; then
  echo "O projeto tem utilizadores fora de @exemplo.test. Por segurança, o seed não corre aqui." >&2
  exit 1
fi
if [[ "$(jq -r '.ja_carregado' <<<"$state")" == "true" ]]; then
  echo "O seed já foi carregado neste projeto. Nada a fazer."
  exit 0
fi

ROLE_PREFIX=""
if [[ "$(sql "select current_user <> 'postgres' as other" | jq -r '.[0].other')" == "true" ]]; then
  ROLE_PREFIX="set local role postgres;"
fi
sql "$ROLE_PREFIX
$(cat "$ROOT/supabase/seed.sql")" >/dev/null
echo "Dados fictícios carregados: $(sql "select count(*)::int as utilizadores from auth.users" | jq -c '.[0]')"
