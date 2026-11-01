#!/usr/bin/env bash
# Teste de ponta a ponta contra o projeto Supabase de DESENVOLVIMENTO (só dados fictícios).
# Vai buscar as chaves do projeto à Management API e passa-as só ao processo do teste: nunca
# ficam escritas em ficheiros. Precisa das dependências do portal (npm --prefix web install).
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/e2e.sh
source "$(dirname "$0")/_lib.sh"

keys="$(api GET "/projects/$REF/api-keys?reveal=true")"
pick() {
  jq -r --arg legacy "$1" --arg type "$2" '
    (map(select(.name == $legacy and (.api_key // "") != "")) + map(select(.type == $type and (.api_key // "") != "")))
    | first | .api_key // empty' <<<"$keys"
}
SUPABASE_ANON_KEY="$(pick anon publishable)"
SUPABASE_SERVICE_ROLE_KEY="$(pick service_role secret)"
[[ -n "$SUPABASE_ANON_KEY" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Não encontrei as chaves do projeto." >&2; exit 1; }

export SUPABASE_URL="https://$REF.supabase.co" SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export SITE_URL="${SITE_URL:-http://localhost:5173}"
# O fetch do Node só usa o proxy de saída (quando existe) com esta opção.
export NODE_USE_ENV_PROXY=1
exec node "$ROOT/scripts/remote/e2e.mjs"
