#!/usr/bin/env bash
# Definições de autenticação do projeto (Authentication no painel do Supabase), pela Management API.
#
# Sem argumentos: mostra o valor atual e o pretendido de cada definição. Não altera nada.
# Com --apply: aplica as definições pretendidas. Se o hook de email ficar ligado, gera um segredo
# novo e define-o primeiro na função (SEND_EMAIL_HOOK_SECRET) e depois no Supabase Auth.
#
# Variáveis (valores por omissão = projeto de desenvolvimento):
#   SITE_URL            http://localhost:5173
#   REDIRECT_URLS       http://localhost:5173/**,http://127.0.0.1:5173/**
#   ENABLE_EMAIL_HOOK   true (emails de autenticação pela função auth-send-email)
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/auth-config.sh [--apply]
source "$(dirname "$0")/_lib.sh"

SITE_URL="${SITE_URL:-http://localhost:5173}"
REDIRECT_URLS="${REDIRECT_URLS:-http://localhost:5173/**,http://127.0.0.1:5173/**}"
ENABLE_EMAIL_HOOK="${ENABLE_EMAIL_HOOK:-true}"
HOOK_URI="https://$REF.supabase.co/functions/v1/auth-send-email"

# Igual a supabase/config.toml (secção [auth]) e ao README ("Configurar um projeto Supabase").
desired="$(jq -n \
  --arg site "$SITE_URL" --arg redirects "$REDIRECT_URLS" \
  --argjson hook "$ENABLE_EMAIL_HOOK" --arg hook_uri "$HOOK_URI" '{
    disable_signup: true,
    external_anonymous_users_enabled: false,
    security_manual_linking_enabled: false,
    external_email_enabled: true,
    site_url: $site,
    uri_allow_list: $redirects,
    mailer_otp_exp: 3600,
    mailer_otp_length: 6,
    password_min_length: 12,
    password_required_characters: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true,
    mfa_phone_enroll_enabled: false,
    mfa_phone_verify_enabled: false,
    hook_send_email_enabled: $hook
  } + (if $hook then {hook_send_email_uri: $hook_uri} else {} end)')"

current="$(api GET "/projects/$REF/config/auth")"

printf '%-36s %-45s %s\n' "Definição" "Atual" "Pretendido"
jq -r --argjson want "$desired" '
  . as $cur | $want | to_entries[] |
  [.key, ($cur[.key] | tostring), (.value | tostring),
   (if ($cur[.key] | tostring) == (.value | tostring) then "" else "  ← muda" end)] | join("\u001f")' <<<"$current" |
  while IFS=$'\x1f' read -r key cur want mark; do
    printf '%-36s %-45s %s%s\n' "$key" "${cur:0:44}" "$want" "$mark"
  done
echo "hook_send_email_secrets                ($(jq -r 'if (.hook_send_email_secrets // "") == "" then "vazio" else "definido" end' <<<"$current"); com --apply e o hook ligado, é gerado um novo)"

if [[ "${1:-}" != "--apply" ]]; then
  echo
  echo "Nada foi alterado. Para aplicar: $0 --apply"
  exit 0
fi

patch="$desired"
if [[ "$ENABLE_EMAIL_HOOK" == "true" ]]; then
  secret="v1,whsec_$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
  "$(dirname "$0")/secrets-set.sh" "SEND_EMAIL_HOOK_SECRET=$secret"
  patch="$(jq -c --arg s "$secret" '. + {hook_send_email_secrets: $s}' <<<"$desired")"
fi
api PATCH "/projects/$REF/config/auth" -H 'content-type: application/json' --data-binary "$patch" >/dev/null
echo "Definições de autenticação aplicadas."
