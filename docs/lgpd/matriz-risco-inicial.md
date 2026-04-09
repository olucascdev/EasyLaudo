# Matriz de Risco Inicial (LGPD + Seguranca)

## Escala

- Probabilidade: Baixa / Media / Alta
- Impacto: Baixo / Medio / Alto / Critico

## Riscos priorizados

| ID | Risco | Probabilidade | Impacto | Nivel | Tratativa |
|---|---|---|---|---|---|
| R-01 | uso de segredo JWT fraco ou padrao | Alta | Critico | Critico | segredo obrigatorio com tamanho minimo e validacao em startup |
| R-02 | vazamento de detalhes internos em erros da API | Media | Alto | Alto | resposta generica ao cliente e log tecnico no servidor |
| R-03 | path traversal no acesso a arquivos | Media | Alto | Alto | validacao de caminho relativo dentro da raiz de storage |
| R-04 | upload malicioso (zip bomb/arquivo invalido) | Alta | Alto | Alto | limite de tamanho, validacao de MIME/estrutura e razao de compressao |
| R-05 | cookie de sessao inseguro em producao | Media | Alto | Alto | `COOKIE_SECURE` e `COOKIE_SAMESITE` validados por configuracao |
| R-06 | transferencia internacional via IA sem governanca | Media | Alto | Alto | registrar base legal, DPA e controles contratuais |
| R-07 | retencao indefinida de dados sensiveis | Alta | Alto | Alto | politica de retencao com job de expurgo |

## Itens pendentes apos fase 2

- trilha de auditoria por acao sensivel (download, exclusao, extracao).
- automacao de expurgo por tipo de dado/arquivo.
- fluxo completo de atendimento dos direitos do titular com evidencias.
- hardening de auth adicional: rate limiting e lockout progressivo.
- RIPD formal e procedimento de comunicacao de incidente (ANPD/titulares).
