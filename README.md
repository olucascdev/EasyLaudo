# EasyLaudo

Monorepo do MVP do EasyLaudo com frontend em Next.js 14 e backend em FastAPI.

## Estrutura

- `apps/web`: interface web
- `apps/api`: API FastAPI
- `storage/`: uploads e arquivos gerados em ambiente local

## Subir localmente

1. Configure `apps/api/.env` e `apps/web/.env.local`.
2. Crie as tabelas executando o SQL em `apps/api/db/migrations/001_init.sql`.
3. Suba com Docker Compose:

```bash
docker compose up --build
```

## Fluxos do MVP

- Cadastro/login com JWT em cookie httpOnly
- Upload de modelos DOCX e detecção de `{{campos}}`
- Upload de planilhas XLSX com preview
- Mapeamento planilha -> template com sugestão automática
- Geração de DOCX individual e em lote
- Extração de dados de DOCX e exportação para XLSX

