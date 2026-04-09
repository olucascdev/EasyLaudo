# Fase 3 - Execucao Inicial (Privacy by Design)

## Itens iniciados

- Politica de retencao aplicada por configuracao de ambiente.
- Rotina de limpeza com suporte a `dry_run` para validacao segura.
- Endpoints de direitos do titular:
  - exportacao de dados do proprio usuario;
  - exclusao de conta e dados vinculados.
- Tela de transparencia e direitos LGPD no frontend (`/privacidade`).
- Log de auditoria para operacoes sensiveis de LGPD.

## Endpoints novos

- `GET /lgpd/me/export`
- `DELETE /lgpd/me`
- `GET /lgpd/retention/policy`
- `GET /lgpd/transparencia`
- `POST /compliance/retention/run` (com token de manutencao)

## Pendencias para fechar fase

- Automacao de agenda do job de retencao (cron/worker).
- Trilha de auditoria persistida em banco (atualmente em log estruturado).
- Fluxo administrativo para atendimento de titular por terceiro autorizado.
