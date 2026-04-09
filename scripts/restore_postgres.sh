#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL nao configurada"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <arquivo_dump>"
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Arquivo nao encontrado: $DUMP_FILE"
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP_FILE"

echo "Restore concluido a partir de: $DUMP_FILE"
