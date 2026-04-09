# Inventario de Controles de Seguranca do Sistema

Este documento consolida os controles tecnicos atualmente implementados no EasyLaudo.

## 1) Autenticacao e sessao

- JWT assinado com HMAC SHA-256 em `apps/api/services/auth_service.py`.
- `JWT_SECRET` obrigatoria com minimo de 32 caracteres (fail-fast no startup).
- Cookie de sessao `HttpOnly`, com `Secure` e `SameSite` configuraveis.
- Expiracao de token por tempo (`exp`) e validacao de assinatura no backend.
- Senha armazenada com PBKDF2-HMAC-SHA256 e salt unico por usuario.

## 2) Protecao contra brute force e abuso

- Lockout progressivo de login por email (hash) e IP em `apps/api/services/login_protection_service.py`.
- Rate limiting por categoria de rota em `apps/api/services/rate_limit_service.py`:
  - `auth`,
  - `upload`,
  - `general`.
- Middleware global de limitacao em `apps/api/main.py` com resposta `429` e `Retry-After`.

## 3) Autorizacao e isolamento de dados

- Endpoints de dominio usam `get_current_user` com filtro por `user_id` para acesso a recursos.
- Validacao de ownership aplicada em fluxos de modelos, planilhas, mapeamento e laudos.
- Endpoints LGPD limitados ao proprio titular (`/lgpd/me/*`).

## 4) Upload seguro de arquivos

- Validacao de uploads DOCX/XLSX em `apps/api/services/upload_security_service.py`:
  - extensao,
  - MIME permitido,
  - limite de tamanho,
  - estrutura ZIP esperada,
  - limite de entradas,
  - limite de tamanho descompactado,
  - limite de razao de compressao (anti zip bomb).
- Limite de quantidade de arquivos no lote de extracao (`MAX_EXTRACTION_FILES`).

## 5) Seguranca de filesystem/storage

- Sanitizacao de nome de arquivo antes de persistir em `apps/api/services/storage_service.py`.
- Bloqueio de path traversal e caminho absoluto em `resolve_storage_path`.
- Persistencia segregada por `user_id` e categoria de arquivo.

## 6) Tratamento de erros e observabilidade

- Handler global evita vazamento de stack trace ao cliente.
- `X-Request-ID` adicionado em todas as respostas para correlacao.
- Auditoria de eventos sensiveis em log estruturado JSON via `apps/api/services/audit_service.py`.

## 7) Privacidade e LGPD implementadas

- Endpoints de direitos do titular:
  - `GET /lgpd/me/export`,
  - `DELETE /lgpd/me`.
- Endpoint de transparencia de tratamento: `GET /lgpd/transparencia`.
- Politica de retencao configuravel por ambiente.
- Rotina de limpeza de dados e arquivos por TTL em `apps/api/services/retention_service.py`.
- Execucao de retencao por endpoint protegido por token de manutencao (`/compliance/retention/run`).

## 8) Integracao com IA (extracao)

- Chave de IA obrigatoria quando uso habilitado.
- Possibilidade de desligar extracao por IA com `ALLOW_AI_EXTRACTION=false`.
- Limites de entrada para IA:
  - maximo de caracteres (`MAX_IA_INPUT_CHARS`),
  - maximo de campos (`MAX_IA_FIELDS`).

## 9) Seguranca no gateway/proxy (Nginx)

- `server_tokens off`.
- `client_max_body_size` definido.
- Headers de seguranca:
  - `X-Frame-Options: DENY`,
  - `X-Content-Type-Options: nosniff`,
  - `Referrer-Policy: strict-origin-when-cross-origin`,
  - `Permissions-Policy` restritiva.

## 10) Configuracao segura por ambiente

- Variaveis de seguranca e compliance documentadas em `apps/api/.env.example`.
- Validacoes de configuracao executadas no startup em `apps/api/main.py`.

## 11) Operacao de continuidade (backup/restore)

- Script de backup Postgres: `scripts/backup_postgres.sh`.
- Script de restore Postgres: `scripts/restore_postgres.sh`.

## 12) Controles validados na fase 6

- Relatorio da simulacao red team controlada em `docs/lgpd/fase-6-red-team-relatorio.md`.
- Script de validacao dos controles: `scripts/fase6_redteam_controlado.py`.

## 13) Riscos residuais e melhorias priorizadas

- Rate limit/lockout ainda em memoria local (nao distribuido).
- Falta monitoramento central com alerta ativo para anomalias de seguranca.
- Falta hardening adicional de transporte (TLS/HSTS em ambiente publico).
- Falta persistencia de trilha de auditoria em banco para consulta forense completa.
