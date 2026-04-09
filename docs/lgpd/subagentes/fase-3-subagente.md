# Playbook de Subagente - Fase 3 (Privacy by Design)

## Objetivo

- Implementar controles de privacidade por padrao no fluxo fim a fim (coleta, uso, armazenamento, compartilhamento e descarte) do EasyLaudo.
- Reduzir exposicao de dados pessoais/sensiveis nas rotas FastAPI e nas telas Next.js sem quebrar a operacao atual.
- Entregar base tecnica para direitos do titular (acesso, eliminacao, retificacao, portabilidade) com trilha de evidencias.

## Escopo tecnico no projeto atual

- Stack:
  - Backend FastAPI (`apps/api`) com autenticacao JWT/cookie e rotas de upload, extracao e geracao.
  - Frontend Next.js (`apps/web`) com fluxos de editor, modelos, planilhas e laudos.
  - Storage local para arquivos (`templates`, `spreadsheets`, `reports`, temporarios).
- Entidades prioritarias do banco:
  - `users`
  - `templates`
  - `spreadsheets`
  - `mappings`
  - `reports`
  - `editor_drafts`
- Fronteiras de risco:
  - Upload e persistencia de arquivos sensiveis.
  - Campo `patient_data` em `reports` e `patients` em `editor_drafts`.
  - Integracao com IA na extracao (`/extracao/processar`) com potencial transferencia internacional.

## Backlog de implementacao (sprints curtas)

### Sprint 1 (1 semana) - Minimizacao e retencao automatica

- Backend:
  - Criar job agendado para descarte por idade com politicas iniciais ja definidas:
    - `editor_drafts`: 30 dias sem uso.
    - `spreadsheets`: 180 dias.
    - `reports`: 365 dias.
    - temporarios (`template_drafts`, `extractions`): 7 dias.
  - Adicionar campo de metadata de ciclo de vida (ex.: `expires_at`/`last_access_at`) nas entidades que ainda nao possuem suporte de retencao.
  - Garantir exclusao dupla: registro no banco + arquivo fisico no storage.
- Frontend:
  - Exibir aviso de retencao nos pontos de upload/geracao (modelo, planilha, laudo, extracao).
  - Exibir status simples de expiracao (quando aplicavel) para o usuario.
- Entrega:
  - Script/servico de limpeza idempotente e logado.

### Sprint 2 (1 semana) - Direitos do titular e operacoes seguras

- Backend:
  - Criar endpoints internos/admin para:
    - exportacao de dados do titular (JSON estruturado por tabela e arquivos vinculados).
    - eliminacao de dados por usuario com soft delete inicial e purge controlado.
    - retificacao de dados cadastrais essenciais em `users`.
  - Padronizar identificadores de auditoria por requisicao (`request_id`) nas operacoes de alta sensibilidade.
- Frontend:
  - Criar tela/admin minimo para disparar exportacao e eliminacao por `user_id`.
  - Mostrar progresso/resultado das solicitacoes com protocolo.
- Entrega:
  - Fluxo operacional completo para atendimento de solicitacao LGPD.

### Sprint 3 (1 semana) - Privacy by default e compartilhamento com terceiros

- Backend:
  - Revisar payload enviado ao provedor de IA para extracao e remover campos nao necessarios.
  - Aplicar mascaramento parcial em logs (email, identificadores de paciente, caminhos sensiveis).
  - Incluir controle explicito para desativar integracao de IA por ambiente/tenant.
- Frontend:
  - Inserir informacao clara de uso com terceiros no fluxo de extracao.
  - Adicionar configuracao visual para habilitar/desabilitar extracao por IA (quando permitido pelo perfil).
- Entrega:
  - Integracao de terceiros com principio de necessidade e transparencia reforcada.

## Checklist de conformidade LGPD (implementacao)

- [ ] Minimizacao: cada endpoint coleta e retorna apenas campos estritamente necessarios.
- [ ] Finalidade: cada tabela/arquivo possui finalidade documentada e aderente ao inventario.
- [ ] Retencao: politica aplicada automaticamente com exclusao verificavel.
- [ ] Seguranca: dados sensiveis nao aparecem em logs de aplicacao e erros HTTP.
- [ ] Direitos do titular: acesso, correcao, eliminacao e portabilidade operacionalizados.
- [ ] Transparencia: UI informa tratamento, prazos e compartilhamento com terceiros.
- [ ] Auditoria: eventos criticos possuem protocolo, timestamp e ator responsavel.
- [ ] Transferencia internacional: fluxo de IA com base legal e registro de justificativa.

## Criterios de aceite

- Existe mecanismo automatico de descarte executando sem impacto em rotas de negocio.
- Exclusao LGPD remove dados de `users`, `templates`, `spreadsheets`, `mappings`, `reports`, `editor_drafts` conforme vinculo do titular e regras de negocio.
- Exportacao LGPD gera pacote consistente (JSON + referencias de arquivos) por titular.
- Logs de producao nao exibem texto clinico bruto nem identificadores diretos sem mascaramento.
- Fluxos Next.js exibem informacoes de privacidade em pontos de coleta sensivel.
- Evidencias tecnicas e funcionais ficam registradas em docs e artefatos de execucao.

## Evidencias esperadas

- Documento de desenho tecnico da Fase 3 com decisoes de minimizacao e retencao.
- PRs com:
  - migracoes de schema (se houver),
  - servico/job de descarte,
  - endpoints de direitos do titular,
  - ajustes de UI no Next.js.
- Logs de execucao do job de retencao com contagem por tabela/categoria de arquivo.
- Relatorio de teste com cenarios:
  - expiracao automatica,
  - exportacao por titular,
  - eliminacao por titular,
  - mascaramento de logs,
  - extracao IA com payload minimizado.
- Atualizacao do inventario LGPD quando houver mudanca de dado, finalidade ou prazo.

## Riscos e mitigacoes

- Risco: exclusao em cascata remover dados necessarios para operacao.
  - Mitigacao: soft delete + janela de seguranca + job de purge separado.
- Risco: job de retencao apagar arquivo sem remover referencia no banco (ou vice-versa).
  - Mitigacao: transacao logica com reconciliacao periodica e relatorio de inconsistencias.
- Risco: regressao de performance em consultas com novos filtros de ciclo de vida.
  - Mitigacao: indices apropriados (`updated_at`, `expires_at`, `user_id`) e testes de carga leves.
- Risco: envio excessivo de dados para IA por falha de mapeamento.
  - Mitigacao: whitelist de campos permitidos no payload e teste automatizado de contrato.
- Risco: operacao manual sem trilha de auditoria.
  - Mitigacao: obrigatoriedade de protocolo e `request_id` em toda acao administrativa LGPD.

## Prompt operacional reutilizavel (subagente IA)

```text
Voce e o subagente de Privacy by Design do EasyLaudo.

Contexto tecnico obrigatorio:
- Backend FastAPI em apps/api.
- Frontend Next.js em apps/web.
- Tabelas alvo: users, templates, spreadsheets, mappings, reports, editor_drafts.
- Foco LGPD: minimizacao, retencao, direitos do titular, auditoria e transparencia.

Objetivo da execucao:
Implementar a Fase 3 com mudancas pequenas, testaveis e seguras, sem quebrar os fluxos atuais de autenticacao, upload, extracao e geracao de laudos.

Regras de execucao:
1) Mapear o fluxo de dados por tabela e endpoint antes de editar.
2) Priorizar entrega incremental por sprint curta:
   - Sprint 1: retencao automatica e descarte.
   - Sprint 2: exportacao/eliminacao/acesso de titular.
   - Sprint 3: minimizacao no terceiro (IA) e transparencia no frontend.
3) Em toda alteracao, incluir criterio de aceite testavel e evidencia esperada.
4) Nao expor dados sensiveis em logs/erros.
5) Preservar compatibilidade com padroes ja existentes no projeto.

Formato de saida obrigatorio:
- Plano de implementacao (passo a passo curto).
- Arquivos que serao alterados.
- Riscos por alteracao e mitigacao.
- Testes que comprovam conformidade LGPD.
- Resultado final com checklist [ok/pendente].
```
