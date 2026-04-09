# Fase 1 - Governanca LGPD (EasyLaudo)

## Escopo

- Produto: EasyLaudo (web + API + armazenamento local).
- Dados tratados: dados pessoais e dados pessoais sensiveis de saude em laudos e planilhas.
- Abrangencia: fluxos de autenticacao, importacao de planilhas, upload de modelos, geracao de laudos, extracao e exportacao.

## Papeis e responsabilidades

- Controlador: EasyLaudo (operacao do produto e definicao das finalidades de tratamento).
- Operador: provedores de infraestrutura e servicos de terceiros usados pela plataforma.
- Encarregado (DPO): responsavel interno por receber demandas de titulares e coordenar incidentes.
- Time de Engenharia: implementar privacy by design, controles tecnicos e trilha de auditoria.
- Time Juridico/Compliance: base legal, contratos com operadores e comunicacao regulatoria.

## Objetivos da fase

- Estabelecer inventario formal de dados e bases legais.
- Classificar dados por criticidade (pessoal x sensivel).
- Definir politica inicial de retencao e descarte.
- Definir fluxo de atendimento de direitos do titular.

## Bases legais iniciais (hipotese de trabalho)

- Execucao de contrato (art. 7, V): autenticacao, operacao do workspace e entrega dos laudos.
- Exercicio regular de direitos (art. 7, VI): guarda de evidencias e auditoria quando aplicavel.
- Protecao da vida e tutela da saude (arts. 7 e 11): quando aplicavel ao contexto clinico.
- Consentimento explicito (art. 11, I): para usos opcionais fora da finalidade principal.

## Politica inicial de retencao

- `users`: enquanto houver conta ativa e pelo periodo legal minimo necessario.
- `templates`: enquanto vinculados a fluxos ativos do usuario.
- `spreadsheets`: 180 dias por padrao (ajustavel por contrato/politica interna).
- `reports`: 365 dias por padrao (ajustavel por necessidade clinica e regulatoria).
- `editor_drafts`: 30 dias sem atividade.
- Arquivos temporarios de upload (`template_drafts`, `extractions`): descarte em ate 7 dias.

## Fluxo de direitos do titular

- Canal unico de requisicoes (email/formulario dedicado).
- SLA interno: triagem em ate 2 dias uteis; conclusao em ate 15 dias.
- Tipos cobertos: confirmacao de tratamento, acesso, correcao, anonimização, eliminacao e portabilidade.
- Registro de atendimento: protocolo, data, decisao e evidencia de execucao tecnica.

## Entregaveis desta fase

- Inventario de dados: `docs/lgpd/inventario-dados.md`.
- Matriz de risco inicial: `docs/lgpd/matriz-risco-inicial.md`.
- Lista de controles P0 implementados: `docs/lgpd/fase-2-hardening.md`.
