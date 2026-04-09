# Fase 4 - Execucao Inicial (Infra e AppSec)

## Itens iniciados

- Rate limiting em middleware da API por categoria de rota:
  - autenticacao,
  - uploads,
  - trafego geral.
- Lockout progressivo de login por email (hash) e IP apos repetidas falhas.
- `X-Request-ID` em todas as respostas para correlacao de logs e incidentes.
- Hardening no Nginx com headers defensivos e limite de upload.
- Validacao de configuracao de seguranca no startup (fail fast).

## Configuracoes novas

- `RATE_LIMIT_AUTH_PER_MIN`
- `RATE_LIMIT_UPLOAD_PER_MIN`
- `RATE_LIMIT_GENERAL_PER_MIN`
- `LOGIN_LOCKOUT_FAILURES`
- `LOGIN_LOCKOUT_SECONDS`
- `LOGIN_REPEATED_LOCKOUT_SECONDS`
- `LOGIN_ATTEMPT_TTL_SECONDS`

## Utilitarios operacionais

- Backup Postgres: `scripts/backup_postgres.sh`
- Restore Postgres: `scripts/restore_postgres.sh`

## Pendencias para fechar fase

- Persistir lockout/rate limit em storage distribuido (ex.: Redis) para multi-instancia.
- Alertas e dashboards operacionais com metricas de 429 e lockout.
- Runbook de backup/restore automatizado com evidencias periodicas.
