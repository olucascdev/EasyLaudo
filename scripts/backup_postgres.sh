#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL nao configurada"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUTPUT_FILE="$BACKUP_DIR/easylaudo_${STAMP}.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUTPUT_FILE"

echo "Backup criado em: $OUTPUT_FILE"
