#!/usr/bin/env bash
# Carrega o logótipo e o símbolo de uma organização (branding/<slug>/logotipo.png e simbolo.png e,
# se existir, logotipo-fundo-escuro.png) para o bucket público "branding", na pasta da organização,
# e só depois preenche organizations.logo_path, theme.symbol_path e theme.logo_dark_path.
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

files=(logotipo.png simbolo.png)
[[ -f "$DIR/logotipo-fundo-escuro.png" ]] && files+=(logotipo-fundo-escuro.png)

for file in "${files[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${auth[@]}" \
    -H "x-upsert: true" -H "content-type: image/png" -H "cache-control: max-age=3600" \
    --data-binary @"$DIR/$file" "https://$REF.supabase.co/storage/v1/object/branding/$org_id/$file")"
  [[ "$code" == 200 ]] || { echo "Upload de $file falhou (HTTP $code)." >&2; exit 1; }
  echo "→ branding/$org_id/$file"
done

dark_path="null"
[[ " ${files[*]} " == *" logotipo-fundo-escuro.png "* ]] && dark_path="$(sql_quote "$org_id/logotipo-fundo-escuro.png")"
sql "update public.organizations
set logo_path = $(sql_quote "$org_id/logotipo.png"),
    theme = jsonb_strip_nulls(coalesce(theme, '{}'::jsonb) || jsonb_build_object(
      'symbol_path', $(sql_quote "$org_id/simbolo.png")::text,
      'logo_dark_path', $dark_path::text))
where id = $(sql_quote "$org_id")::uuid" >/dev/null
echo "Marca de '$SLUG' carregada: https://$REF.supabase.co/storage/v1/object/public/branding/$org_id/logotipo.png"
