#!/usr/bin/env bash
# Carrega o logótipo e o símbolo de uma organização (branding/<slug>/logotipo.png e simbolo.png,
# ficheiros da marca sem alterações) para o bucket público "branding", na pasta da organização,
# e só depois preenche organizations.logo_path e theme.symbol_path.
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/branding-upload.sh [slug]   (por omissão: orvel)
source "$(dirname "$0")/_lib.sh"

SLUG="${1:-orvel}"
DIR="$ROOT/branding/$SLUG"
for file in logotipo.png simbolo.png; do
  [[ -f "$DIR/$file" ]] || { echo "Falta $DIR/$file" >&2; exit 1; }
done

org_id="$(sql "select id from public.organizations where slug = $(sql_quote "$SLUG")" | jq -r '.[0].id // empty')"
[[ -n "$org_id" ]] || { echo "Organização '$SLUG' não existe no projeto." >&2; exit 1; }

service_key="$(project_key service)"
[[ -n "$service_key" ]] || { echo "Não encontrei a chave de serviço do projeto." >&2; exit 1; }
auth=(-H "apikey: $service_key")
# As chaves antigas (JWT) também vão no Authorization; as novas (sb_secret_…) só no apikey.
[[ "$service_key" == eyJ* ]] && auth+=(-H "Authorization: Bearer $service_key")

for file in logotipo.png simbolo.png; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${auth[@]}" \
    -H "x-upsert: true" -H "content-type: image/png" -H "cache-control: max-age=3600" \
    --data-binary @"$DIR/$file" "https://$REF.supabase.co/storage/v1/object/branding/$org_id/$file")"
  [[ "$code" == 200 ]] || { echo "Upload de $file falhou (HTTP $code)." >&2; exit 1; }
  echo "→ branding/$org_id/$file"
done

sql "update public.organizations
set logo_path = $(sql_quote "$org_id/logotipo.png"),
    theme = jsonb_set(coalesce(theme, '{}'::jsonb), '{symbol_path}', to_jsonb($(sql_quote "$org_id/simbolo.png")::text))
where id = $(sql_quote "$org_id")::uuid" >/dev/null
echo "Marca de '$SLUG' carregada: https://$REF.supabase.co/storage/v1/object/public/branding/$org_id/logotipo.png"
