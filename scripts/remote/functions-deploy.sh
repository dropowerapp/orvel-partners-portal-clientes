#!/usr/bin/env bash
# Publica Edge Functions pela Management API (equivalente a `supabase functions deploy --use-api`).
# O verify_jwt de cada função vem de supabase/config.toml ([functions.<nome>]).
# Envia o index.ts e os restantes ficheiros da função e de _shared/ (o Supabase faz o bundle).
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/functions-deploy.sh [função ...]
#      (sem argumentos: invite-client e auth-send-email)
source "$(dirname "$0")/_lib.sh"

FUNCTIONS_DIR="supabase/functions"
[[ $# -gt 0 ]] || set -- invite-client auth-send-email

# verify_jwt da função em config.toml (por omissão true, como no Supabase).
verify_jwt() {
  local value
  value="$(awk -v section="[functions.$1]" '
    $0 == section { inside = 1; next }
    /^\[/ { inside = 0 }
    inside && $1 == "verify_jwt" { gsub(/[ \t]/, "", $0); split($0, kv, "="); print kv[2]; exit }
  ' "$ROOT/supabase/config.toml")"
  [[ "$value" == "false" ]] && echo false || echo true
}

cd "$ROOT"
for slug in "$@"; do
  [[ -f "$FUNCTIONS_DIR/$slug/index.ts" ]] || { echo "Função desconhecida: $slug" >&2; exit 1; }
  jwt="$(verify_jwt "$slug")"
  metadata="$(jq -nc --arg name "$slug" --arg entry "$FUNCTIONS_DIR/$slug/index.ts" --argjson jwt "$jwt" \
    '{name: $name, entrypoint_path: $entry, verify_jwt: $jwt}')"
  files=()
  while IFS= read -r f; do
    files+=(-F "file=@$f;filename=$f")
  done < <(find "$FUNCTIONS_DIR/$slug" "$FUNCTIONS_DIR/_shared" -type f \( -name '*.ts' -o -name '*.json' \) \
             ! -name '*_test.ts' ! -name '*.test.ts' | sort)
  echo "→ $slug (verify_jwt=$jwt, $(( ${#files[@]} / 2 )) ficheiros)"
  result="$(api POST "/projects/$REF/functions/deploy?slug=$slug" -F "metadata=$metadata;type=application/json" "${files[@]}")"
  jq -c '{slug, status, version, verify_jwt}' <<<"$result"
done
