# Funções comuns dos scripts remotos: falam com o projeto Supabase pela Management API
# (https://api.supabase.com), sem ligação direta ao Postgres e sem o supabase CLI.
#
# Variáveis:
#   SUPABASE_PROJECT_REF   referência do projeto (obrigatória)
#   SUPABASE_ACCESS_TOKEN  token pessoal (sbp_...). Opcional: num ambiente em que um proxy
#                          acrescenta o token aos pedidos para api.supabase.com, deixar vazia.
# Nunca escrever tokens nem chaves em ficheiros do repositório.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="${SUPABASE_API_URL:-https://api.supabase.com}"
: "${SUPABASE_PROJECT_REF:?Defina SUPABASE_PROJECT_REF (referência do projeto Supabase)}"
REF="$SUPABASE_PROJECT_REF"

for bin in curl jq; do
  command -v "$bin" >/dev/null || { echo "Falta o comando '$bin'." >&2; exit 1; }
done

# api MÉTODO CAMINHO [argumentos extra do curl]  → corpo da resposta; falha se HTTP >= 400.
api() {
  local method="$1" path="$2"
  shift 2
  local auth=()
  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then auth=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"); fi
  local out code
  out="$(mktemp)"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "${auth[@]}" "$API/v1$path" "$@")" || {
    rm -f "$out"; echo "Pedido falhou: $method $path" >&2; return 1; }
  if [[ "$code" -ge 400 ]]; then
    echo "HTTP $code em $method $path: $(head -c 200000 "$out")" >&2
    rm -f "$out"
    return 1
  fi
  cat "$out"
  rm -f "$out"
}

# sql "consulta"  → resultado em JSON (linhas da última instrução).
sql() {
  jq -n --arg q "$1" '{query: $q}' | api POST "/projects/$REF/database/query" \
    -H 'content-type: application/json' --data-binary @-
}

# sql_file ficheiro  → corre o ficheiro inteiro num só pedido.
sql_file() {
  sql "$(cat "$1")"
}

# Escapa um texto para usar entre plicas em SQL.
sql_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
}
