#!/usr/bin/env bash
# Teste de ponta a ponta contra o projeto Supabase de DESENVOLVIMENTO (só dados fictícios).
# Vai buscar as chaves do projeto à Management API e passa-as só ao processo do teste: nunca
# ficam escritas em ficheiros. Precisa das dependências do portal (npm --prefix web install).
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/e2e.sh
source "$(dirname "$0")/_lib.sh"

SUPABASE_ANON_KEY="$(project_key anon)"
SUPABASE_SERVICE_ROLE_KEY="$(project_key service)"
[[ -n "$SUPABASE_ANON_KEY" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Não encontrei as chaves do projeto." >&2; exit 1; }

export SUPABASE_URL="https://$REF.supabase.co" SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export SITE_URL="${SITE_URL:-http://localhost:5173}"
# O fetch do Node só usa o proxy de saída (quando existe) com esta opção.
export NODE_USE_ENV_PROXY=1
exec node "$ROOT/scripts/remote/e2e.mjs"
