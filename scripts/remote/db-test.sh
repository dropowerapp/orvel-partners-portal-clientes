#!/usr/bin/env bash
# Corre os testes pgTAP de supabase/tests no projeto remoto, pela Management API (sem psql).
# Só para projetos de DESENVOLVIMENTO.
#
# Como o endpoint de SQL só devolve o resultado da última instrução, cada ficheiro de teste é
# adaptado: os resultados vão para uma tabela temporária e, no fim, um erro propositado devolve o
# relatório TAP e desfaz tudo (nenhum dado de teste fica gravado). O ficheiro 00000_setup.sql cria
# o schema "tests" e a extensão pgtap; no fim são removidos (exceto com --keep).
#
# Uso: SUPABASE_PROJECT_REF=<ref> scripts/remote/db-test.sh [--keep] [ficheiro ...]
source "$(dirname "$0")/_lib.sh"

KEEP=false
if [[ "${1:-}" == "--keep" ]]; then KEEP=true; shift; fi
TESTS_DIR="$ROOT/supabase/tests"
[[ $# -gt 0 ]] || set -- $(ls "$TESTS_DIR"/*.sql | grep -v '/00000_setup.sql$')

ROLE_PREFIX=""
if [[ "$(sql "select current_user <> 'postgres' as other" | jq -r '.[0].other')" == "true" ]]; then
  ROLE_PREFIX="set local role postgres;"
fi

# A verificação final (begin … rollback) sai: num só pedido, o rollback desfaria também tudo o
# que vem antes (as instruções anteriores entram na mesma transação).
echo "→ preparação (00000_setup.sql)"
sql "$ROLE_PREFIX
$(sed '/^begin;[[:space:]]*$/,/^rollback;[[:space:]]*$/d' "$TESTS_DIR/00000_setup.sql")" >/dev/null

# Adapta um ficheiro: tira begin/rollback e envia o resultado de cada "select" de topo para _tap.
wrap() {
  echo "$ROLE_PREFIX"
  echo "create temporary table _tap (n serial primary key, line text);"
  echo "grant all on _tap to public; grant all on sequence _tap_n_seq to public;"
  awk '
    BEGIN { start = 1 }
    /^(begin|rollback);[[:space:]]*$/ { next }
    {
      line = $0
      if (start && line ~ /^select /) sub(/^select /, "insert into _tap (line) select ", line)
      print line
      if (line ~ /^[[:space:]]*$/ || line ~ /^[[:space:]]*--/) next
      start = (line ~ /;[[:space:]]*$/)
    }
  ' "$1"
  echo ";"
  echo "do \$tap\$ begin raise exception '%', E'TAP\\n' || coalesce((select string_agg(line, E'\\n' order by n) from _tap), ''); end \$tap\$;"
}

total=0
failed=0
for file in "$@"; do
  name="$(basename "$file")"
  out="$(sql "$(wrap "$file")" 2>&1 || true)"
  if ! grep -q 'TAP' <<<"$out"; then
    echo "✗ $name: erro ao correr"
    echo "$out" | head -c 3000
    echo
    failed=$((failed + 1))
    continue
  fi
  # A mensagem de erro (JSON) traz o relatório TAP a seguir à linha "TAP".
  tap="$(sed -n 's/^HTTP [0-9]* em [A-Z]* [^ ]*: //p' <<<"$out" | jq -r '.message // empty' 2>/dev/null |
    sed -n '/TAP$/,$p' | tail -n +2)"
  ok="$(grep -cE '^ok ' <<<"$tap" || true)"
  nok="$(grep -cE '^not ok ' <<<"$tap" || true)"
  total=$((total + ok + nok))
  if [[ "$ok" -eq 0 || "$nok" -gt 0 ]] || grep -q '^# Looks like' <<<"$tap"; then
    echo "✗ $name: $ok ok, $nok falharam"
    grep -E '^(not ok |#)' <<<"$tap" | head -40
    failed=$((failed + 1))
  else
    echo "✓ $name: $ok ok"
  fi
done

if ! $KEEP; then
  sql "drop schema if exists tests cascade; drop extension if exists pgtap;" >/dev/null
fi
echo "Total: $total testes; ficheiros com falhas: $failed"
[[ $failed -eq 0 ]]
