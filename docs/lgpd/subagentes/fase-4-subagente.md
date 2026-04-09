# Playbook de Subagente - Fase 4 (Infra e AppSec)

## Objetivo da fase

Executar e evidenciar controles tecnicos de infraestrutura e seguranca de aplicacao para reduzir risco operacional e apoiar conformidade LGPD, com foco em:

- hardening de Nginx,
- rate limiting,
- lockout de autenticacao,
- gestao de segredos,
- backup e restauracao,
- monitoramento,
- resposta a incidente.

## Escopo e limites

- Escopo: API, Nginx, banco de dados, pipelines de deploy e operacao.
- Fora de escopo: refatoracoes de produto sem impacto de seguranca, redesign de arquitetura sem aprovacao.
- Regra de ouro: cada mudanca deve ter evidencia tecnica (config, teste, log ou relatorio).

## Entradas obrigatorias

- Estado atual de `nginx.conf`, `docker-compose.yml`, variaveis de ambiente e servicos da API.
- Inventario de ativos criticos (app, banco, storage, secrets).
- Janela de manutencao e responsaveis de on-call.
- Criticidade dos dados tratados (especialmente dados pessoais e sensiveis).

## Plano de execucao por trilha

### 1) Hardening de Nginx

Checklist minimo:

- Definir `server_tokens off`.
- Definir `client_max_body_size` aderente ao limite de upload do app.
- Aplicar headers de seguranca:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Content-Security-Policy` basica para frontend/API
  - `Strict-Transport-Security` quando houver TLS fim a fim
- Restringir metodos HTTP nao usados (ex.: bloquear `TRACE`).
- Definir timeouts defensivos (`client_body_timeout`, `client_header_timeout`, `send_timeout`).
- Ativar access log com formato util para auditoria e correlacao.

Saidas esperadas:

- Arquivo de configuracao versionado.
- Evidencia de reload sem erro (`nginx -t`).
- Resultado de smoke test HTTP 2xx/4xx esperado.

### 2) Rate limiting

Checklist minimo:

- Criar zonas de limite por IP para:
  - endpoints de autenticacao,
  - endpoints de upload/extracao,
  - endpoints gerais da API.
- Definir thresholds iniciais (exemplo operacional):
  - auth: `5 req/min` com burst baixo,
  - upload: `10 req/min` com burst moderado,
  - geral: `60 req/min` por IP.
- Responder com status claro (`429`) e mensagem padrao.
- Incluir excecao controlada para healthcheck interno.

Saidas esperadas:

- Teste de carga curta validando limite e retorno `429`.
- Dashboard/log mostrando contagem de limitacao.

### 3) Lockout de autenticacao

Checklist minimo:

- Implementar contador de tentativas falhas por conta e por IP.
- Definir lockout progressivo (exemplo):
  - 5 falhas: bloqueio 15 min,
  - reincidencia no mesmo dia: 60 min.
- Resetar contador em login bem-sucedido e por janela temporal.
- Logar evento de bloqueio com `user_id` (ou hash), IP e timestamp.
- Mensagem de erro sem revelar se o usuario existe.

Saidas esperadas:

- Teste automatizado cobrindo falhas, lockout e desbloqueio.
- Evidencia de eventos em log e metrica de lockouts.

### 4) Gestao de segredos

Checklist minimo:

- Remover qualquer segredo hardcoded do repositorio.
- Centralizar segredos em variaveis de ambiente/secret manager.
- Exigir segredos criticos no startup (fail fast).
- Definir politica de rotacao (periodica e por incidente).
- Redigir runbook de rotacao (JWT, DB, chaves de integracao).
- Impedir log de segredo em texto claro.

Saidas esperadas:

- Lista de segredos por sistema e dono.
- Evidencia de rotacao simulada em ambiente de homologacao.

### 5) Backup e restauracao

Checklist minimo:

- Definir estrategia de backup:
  - banco: full diario + incremental (ou WAL/binlog),
  - storage de arquivos: snapshot/versionamento.
- Criptografar backup em repouso e em transito.
- Configurar retencao (exemplo: diaria 30 dias, mensal 12 meses).
- Definir e testar restauracao parcial e completa.
- Documentar RPO/RTO alvo por servico.

Saidas esperadas:

- Job de backup automatizado com alerta de falha.
- Teste de restore validado em ambiente isolado com timestamp.

### 6) Monitoramento e alertas

Checklist minimo:

- Padronizar logs estruturados (json) com `request_id`.
- Monitorar sinais minimos:
  - taxa de erro 5xx,
  - latencia p95,
  - autenticacoes falhas,
  - lockouts,
  - `429` por rota,
  - falhas de backup,
  - uso de CPU/memoria/disco.
- Configurar alertas por severidade (info/warn/critical) com canais definidos.
- Garantir retencao de logs para investigacao.

Saidas esperadas:

- Dashboard com KPIs de seguranca e disponibilidade.
- Simulacao de alerta critico com tempo de reconhecimento medido.

### 7) Resposta a incidente

Checklist minimo:

- Definir severidades (SEV1, SEV2, SEV3) com criterios objetivos.
- Criar fluxo operacional:
  - deteccao,
  - triagem,
  - contencao,
  - erradicacao,
  - recuperacao,
  - licoes aprendidas.
- Definir papeis: comandante, comunicacao, tecnico, compliance.
- Preparar templates:
  - abertura de incidente,
  - atualizacao de status,
  - post-mortem.
- Rodar tabletop exercise trimestral.

Saidas esperadas:

- Runbook publicado e versionado.
- Registro de simulacao com tempos de resposta.

## Backlog por prioridade

### P0 (obrigatorio para concluir fase)

| ID | Item | Entregavel | Medida de pronto |
|---|---|---|---|
| P0-01 | Hardening baseline Nginx | Config revisada + teste `nginx -t` | 100% dos headers obrigatorios ativos e sem erro de sintaxe |
| P0-02 | Rate limit em auth/upload | Regras por rota + teste de carga | Requisicoes acima do limite retornam `429` em >= 95% dos testes |
| P0-03 | Lockout de autenticacao | Regra de bloqueio progressivo + logs | Bloqueio apos 5 falhas em <= 1s e desbloqueio por janela validado |
| P0-04 | Segredos criticos fora de codigo | Matriz de segredos + startup fail fast | 0 segredos hardcoded detectados e startup falha sem variavel obrigatoria |
| P0-05 | Backup e restore testado | Job automatizado + relatorio de restore | Restore completo executado com sucesso dentro do RTO definido |
| P0-06 | Alertas minimos operando | Dashboard + regras de alerta | Alerta critico entregue em <= 5 min apos evento simulado |
| P0-07 | Runbook de incidente | Documento versionado + simulacao | Simulacao registrada com MTTA e MTTR medidos |

### P1 (importante, executar na sequencia)

| ID | Item | Entregavel | Medida de pronto |
|---|---|---|---|
| P1-01 | Afinar thresholds de rate limit | Perfil por endpoint | Reducao de falsos positivos para < 2% em 7 dias |
| P1-02 | Rotacao automatizada de segredos | Pipeline de rotacao | Rotacao sem downtime em ambiente de homologacao |
| P1-03 | Correlacao de eventos de seguranca | Painel de trilha de auditoria | 100% dos eventos criticos com `request_id` e ator |
| P1-04 | Teste de restore granular | Restore por tenant/periodo | Tempo de restore parcial dentro de meta acordada |

### P2 (evolucao continua)

| ID | Item | Entregavel | Medida de pronto |
|---|---|---|---|
| P2-01 | WAF/regras avancadas | Politicas adicionais | Queda de eventos maliciosos repetitivos por assinatura |
| P2-02 | Chaos/security drills | Calendario de exercicios | 2 simulacoes concluidas por semestre |
| P2-03 | Scorecard de AppSec | Relatorio mensal | Tendencia de melhoria em risco residual por 3 meses |

## Criterios de aceite mensuraveis da fase

- `100%` dos itens `P0` marcados como concluidos com evidencia anexada.
- `0` segredos criticos em repositorio ou log de aplicacao.
- Taxa de resposta correta de rate limit (`429`) >= `95%` nos cenarios de teste.
- Lockout aplicado em `<= 1s` apos limite de falhas configurado.
- Pelo menos `1` restore completo validado no periodo da fase, com `RTO` e `RPO` dentro da meta.
- Alertas criticos chegam ao canal de on-call em `<= 5 min`.
- Simulacao de incidente registrada com post-mortem publicado em ate `5 dias uteis`.

## Prompt operacional para IA (subagente)

Use o template abaixo para executar a fase com consistencia.

```text
Voce e um subagente de Infra e AppSec focado na Fase 4 do projeto EasyLaudo.

Objetivo:
- Implementar e evidenciar controles de hardening de nginx, rate limiting, lockout de auth,
  gestao de segredos, backup/restauracao, monitoramento e resposta a incidente.

Regras de execucao:
- Nao alterar escopo sem justificativa tecnica.
- Cada alteracao deve gerar evidencia objetiva (config, teste, log, relatorio).
- Priorizar backlog P0 antes de P1/P2.
- Manter linguagem tecnica clara e orientada a risco.

Entradas:
- Arquivos de configuracao atuais (nginx, compose, env, app).
- Metas de RTO/RPO, limites de taxa e politicas de lockout.
- Canais de alerta e responsaveis on-call.

Passos obrigatorios:
1) Diagnosticar estado atual e lacunas por trilha.
2) Propor plano incremental com impacto, risco e rollback.
3) Implementar controles P0 com testes.
4) Coletar evidencias e mapear para criterios de aceite.
5) Publicar relatorio final com pendencias e proximos passos.

Formato de saida esperado:
- "Plano": lista de tarefas por prioridade (P0/P1/P2).
- "Execucao": o que foi aplicado e em quais arquivos/sistemas.
- "Evidencias": testes, logs, metricas e links/artefatos.
- "Aceite": tabela criterio x status (ok/nao ok) com valor medido.
- "Riscos residuais": itens nao mitigados e recomendacao.

Criterio de conclusao:
- Somente concluir quando todos os criterios P0 estiverem comprovados.
```

## Evidencias minimas para auditoria

- Snapshot de configuracao antes/depois de Nginx.
- Resultado de testes de rate limit e lockout.
- Relatorio de varredura de segredos e comprovacao de rotacao.
- Log do backup e prova de restauracao.
- Captura de dashboard/alerta com horario.
- Ata da simulacao de incidente e post-mortem.
