# Playbook de Subagente - Fase 5 (Compliance Avancado LGPD)

## 1) Objetivo da fase
Executar a Fase 5 de compliance avancado LGPD, consolidando controles juridicos, tecnicos e operacionais para reduzir risco regulatorio e elevar prontidao para auditoria.

Esta fase cobre, no minimo:
- RIPD/DPIA para operacoes de maior risco.
- Transferencia internacional de dados pessoais (art. 33 da LGPD).
- Contratos com operadores (DPA e clausulas obrigatorias).
- Plano de resposta a incidente com notificacao (art. 48 da LGPD).
- Evidencia documental e preparacao para auditoria.

## 2) Escopo do subagente
O subagente deve atuar como executor orientado a evidencia.

Entradas esperadas:
- Inventario de dados, bases legais e fluxos de dados atualizados.
- Mapa de fornecedores, operadores e suboperadores.
- Politicas internas vigentes (seguranca, privacidade, retencao, acesso).
- Contratos atuais com terceiros relevantes.
- Registro de incidentes e near misses.

Saidas obrigatorias:
- RIPD/DPIA priorizado, com plano de tratamento de risco.
- Matriz de transferencia internacional por fluxo e mecanismo juridico.
- Pacote de clausulas/contratos com operadores, com lacunas e acoes.
- Plano de resposta a incidente testado (tabletop) e playbook de notificacao.
- Dossie de evidencias com trilha de auditoria e responsaveis.

## 3) Modelo de execucao
### 3.1 Ritos
- Cadencia semanal com checkpoint de risco, pendencias e bloqueios.
- Quadro de trabalho com status: `A Fazer`, `Em Progresso`, `Em Revisao`, `Concluido`, `Evidenciado`.
- Definicao clara de dono por entrega (Juridico, Seguranca, Produto, Engenharia, DPO/Encarregado).

### 3.2 Regra de ouro
Nenhuma atividade conta como concluida sem:
- documento aprovado,
- evidencia rastreavel,
- responsavel nomeado,
- data de revisao definida.

## 4) Frentes obrigatorias
### 4.1 RIPD/DPIA
- Identificar tratamentos de alto risco (dados sensiveis, escala, perfilizacao, decisao automatizada, compartilhamentos amplos).
- Avaliar necessidade e proporcionalidade do tratamento.
- Mapear riscos aos titulares (probabilidade x impacto) e controles existentes.
- Definir plano de mitigacao com prazo, owner e criterio de fechamento.
- Registrar risco residual e aprovacao executiva quando aplicavel.

Artefatos minimos:
- Template padrao de RIPD/DPIA.
- 100% dos processos classificados como alto risco avaliados.
- Registro de decisoes e aprovacoes.

### 4.2 Transferencia internacional (art. 33)
- Identificar todos os fluxos internacionais (armazenamento, suporte, backup, analytics, suboperadores).
- Classificar mecanismo de transferencia por fluxo (clausulas contratuais, normas corporativas, hipoteses legais etc.).
- Validar pais de destino, riscos de jurisdicao e medidas suplementares.
- Implementar e versionar clausulas contratuais aplicaveis.
- Manter inventario vivo de transferencias e base juridica associada.

Artefatos minimos:
- Matriz de transferencia internacional por sistema/fornecedor.
- Gap analysis legal por fluxo.
- Plano de remediacao para fluxos sem mecanismo valido.

### 4.3 Contratos com operadores
- Levantar operadores e suboperadores criticos.
- Revisar contratos com checklist LGPD: finalidade, instrucao documentada, seguranca, confidencialidade, subcontratacao, cooperacao com direitos dos titulares, auditoria, incidente, retorno/eliminacao de dados.
- Emitir aditivos ou novos DPAs para lacunas criticas.
- Definir SLA de notificacao de incidente pelo operador.
- Vincular obrigacoes contratuais a controles tecnicos verificaveis.

Artefatos minimos:
- Checklist de conformidade contratual.
- Matriz de lacunas por operador.
- Pacote de aditivos/DPAs priorizado e acompanhado.

### 4.4 Plano de resposta a incidente (art. 48)
- Formalizar fluxo de deteccao, triagem, classificacao, contencao, erradicacao e recuperacao.
- Definir gatilhos de notificacao ao titular e a ANPD, com papeis e janelas de tempo.
- Criar templates de comunicacao (interna, ANPD, titulares, parceiros).
- Executar ao menos 1 exercicio tabletop por trimestre com registro de licoes aprendidas.
- Integrar com registro de incidentes, runbooks tecnicos e cadeia de escalonamento.

Artefatos minimos:
- Plano de resposta aprovado.
- Arvore de decisao de notificacao art. 48.
- Relatorio de exercicio com plano de melhoria.

### 4.5 Evidencia documental e preparacao para auditoria
- Organizar repositorio de evidencias por controle, data, owner e status.
- Definir taxonomia unica de documentos e convencao de versionamento.
- Montar trilha de auditoria: politica -> procedimento -> execucao -> evidencia.
- Criar checklist de pre-auditoria e executar simulacao.
- Garantir rastreabilidade entre risco, controle e documento comprobatorio.

Artefatos minimos:
- Indice mestre de evidencias.
- Matriz controle x evidencia x owner x validade.
- Relatorio de prontidao para auditoria.

## 5) Backlog por prioridade
### P0 (critico, iniciar imediatamente)
1. Inventariar tratamentos de alto risco e abrir RIPD/DPIA.
2. Mapear transferencias internacionais e identificar fluxos sem mecanismo juridico valido.
3. Publicar versao 1 do plano de resposta a incidente com gatilhos art. 48.
4. Levantar operadores criticos e classificar contratos com risco alto/medio/baixo.
5. Criar estrutura de dossie de evidencia e indice mestre.

### P1 (alto, concluir na fase)
1. Concluir RIPD/DPIA dos processos de alto risco com plano de mitigacao.
2. Enderecar lacunas contratuais criticas com aditivos/DPAs assinados ou em fase final.
3. Definir e implementar medidas suplementares para transferencias de maior risco.
4. Executar tabletop de incidente e fechar plano de melhoria.
5. Construir matriz completa de controle x evidencia com responsaveis e validade.

### P2 (medio, consolidacao)
1. Automatizar coleta de evidencias recorrentes (quando possivel).
2. Treinar areas-chave no fluxo de incidente e uso de templates.
3. Criar painel de indicadores de compliance (KRI/KPI).
4. Realizar simulacao de auditoria com amostragem cruzada.
5. Definir calendario anual de revisao de documentos criticos.

## 6) Criterios de aceite
### Criterios gerais
- 100% dos entregaveis P0 concluidos e evidenciados.
- Cada frente tem owner, aprovador e proxima data de revisao.
- Nao ha lacuna critica sem plano com prazo e responsavel.
- Evidencias estao versionadas e rastreaveis.

### Criterios por frente
- RIPD/DPIA: todos os tratamentos de alto risco avaliados, com risco residual registrado e plano ativo.
- Art. 33: toda transferencia internacional possui mecanismo juridico mapeado e documentado.
- Operadores: contratos criticos com clausulas LGPD essenciais presentes ou em aditivo formal.
- Art. 48: plano de resposta aprovado, exercitado e com templates prontos para uso.
- Auditoria: checklist de pre-auditoria executado e sem nao conformidade critica aberta.

## 7) Evidencias minimas por entrega
- Documento principal aprovado (politica, procedimento, matriz, relatorio).
- Registro de aprovacao (ata, assinatura, ticket ou workflow).
- Evidencia de execucao (ex.: logs de exercicio, tickets de remediacao, historico de versao).
- Indicacao de owner e data de revisao.
- Vinculo explicito com requisito LGPD correspondente.

## 8) Prompt operacional reutilizavel para IA
Use este prompt para acionar um subagente executor da Fase 5:

```text
Voce e um Subagente de Compliance LGPD (Fase 5 - Compliance Avancado).

Contexto:
- Empresa/produto: [preencher]
- DPO/Encarregado: [preencher]
- Estado atual de inventario de dados: [preencher]
- Fornecedores/operadores criticos: [preencher]
- Repositorio de documentos/evidencias: [preencher]
- Prazo da fase: [preencher]

Objetivo:
Entregar RIPD/DPIA, conformidade de transferencia internacional (art. 33), adequacao contratual com operadores, plano de resposta a incidente (art. 48), e dossie de evidencia para auditoria.

Instrucoes de execucao:
1) Gere diagnostico inicial de lacunas por frente (RIPD, art. 33, contratos, art. 48, auditoria).
2) Monte backlog priorizado em P0/P1/P2 com owner, prazo e dependencia.
3) Para cada item, descreva entregavel, risco mitigado e evidencia exigida.
4) Destaque riscos criticos sem controle e proponha acao imediata.
5) Produza templates necessarios (matriz, checklist, plano, comunicacoes).
6) Defina criterios de aceite verificaveis por frente.
7) Entregue um relatorio final com:
   - status por item,
   - bloqueios,
   - decisoes pendentes,
   - proxima onda de execucao.

Formato de saida obrigatorio:
- Secao 1: Diagnostico de lacunas
- Secao 2: Backlog P0/P1/P2 (tabela)
- Secao 3: Criterios de aceite
- Secao 4: Evidencias e trilha de auditoria
- Secao 5: Plano de 30/60/90 dias

Regras:
- Nao marcar atividade como concluida sem evidencia valida.
- Sempre vincular cada entrega ao artigo/principio LGPD aplicavel.
- Se faltar dado, explicitar premissa e risco da premissa.
```

## 9) Definicao de pronto da Fase 5
A Fase 5 esta pronta quando:
- backlog P0 concluido e P1 majoritariamente fechado,
- lacunas criticas possuem remediacao formal em andamento,
- plano de incidente foi exercitado,
- transferencias internacionais estao juridicamente mapeadas,
- dossie de evidencia permite responder uma auditoria sem reconstrucao manual extensa.
