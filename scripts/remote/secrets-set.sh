#!/usr/bin/env bash
# Define segredos das Edge Functions pela Management API (equivalente a `supabase secrets set`).
# Nunca mostra os valores: só os nomes.
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/secrets-set.sh NOME=valor [NOME=valor ...]
#      SUPABASE_PROJECT_REF=<ref> scripts/remote/secrets-set.sh --list
source "$(dirname "$0")/_lib.sh"

if [[ "${1:-}" == "--list" || $# -eq 0 ]]; then
  api GET "/projects/$REF/secrets" | jq -r '.[].name' | sort
  exit 0
fi

payload='[]'
for pair in "$@"; do
  [[ "$pair" == *=* ]] || { echo "Formato esperado NOME=valor (recebido: ${pair%%=*})" >&2; exit 1; }
  name="${pair%%=*}"
  case "$name" in SUPABASE_*) echo "Os segredos SUPABASE_* são definidos pelo próprio Supabase: $name" >&2; exit 1 ;; esac
  payload="$(jq -c --arg n "$name" --arg v "${pair#*=}" '. + [{name: $n, value: $v}]' <<<"$payload")"
done
api POST "/projects/$REF/secrets" -H 'content-type: application/json' --data-binary "$payload" >/dev/null
echo "Segredos definidos: $(jq -r '[.[].name] | join(", ")' <<<"$payload")"
