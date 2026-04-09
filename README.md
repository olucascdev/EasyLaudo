# EasyLaudo

Monorepo do MVP do EasyLaudo com frontend em Next.js 14 e backend em FastAPI.

## Estrutura

- `apps/web`: interface web
- `apps/api`: API FastAPI
- `storage/`: uploads e arquivos gerados em ambiente local

## Subir localmente

1. Configure `apps/api/.env` e `apps/web/.env.local`.
2. Crie as tabelas executando os SQLs em `apps/api/db/migrations/` na ordem numerica.
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

## LGPD e seguranca

- Fase 1 (governanca): `docs/lgpd/fase-1-governanca.md`
- Inventario de dados: `docs/lgpd/inventario-dados.md`
- Matriz de risco inicial: `docs/lgpd/matriz-risco-inicial.md`
- Fase 2 (hardening tecnico): `docs/lgpd/fase-2-hardening.md`
- Subagente Fase 3 (Privacy by Design): `docs/lgpd/subagentes/fase-3-subagente.md`
- Subagente Fase 4 (Infra e AppSec): `docs/lgpd/subagentes/fase-4-subagente.md`
- Subagente Fase 5 (Compliance avancado): `docs/lgpd/subagentes/fase-5-subagente.md`
- Execucao Fase 3: `docs/lgpd/fase-3-execucao.md`
- Execucao Fase 4: `docs/lgpd/fase-4-execucao.md`
- Execucao Fase 5: `docs/lgpd/fase-5-execucao.md`
- Relatorio Fase 6 (Red Team controlado): `docs/lgpd/fase-6-red-team-relatorio.md`
- Inventario geral de seguranca: `docs/seguranca/inventario-controles-seguranca.md`
