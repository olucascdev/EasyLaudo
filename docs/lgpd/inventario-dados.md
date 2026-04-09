# Inventario de Dados - EasyLaudo

## Classificacao

- Publico: sem relacao com titular.
- Pessoal: identifica ou pode identificar pessoa natural.
- Sensivel: dado de saude (art. 5, II, LGPD).

## Banco de dados

| Recurso | Campos principais | Classificacao | Finalidade | Base legal inicial | Retencao inicial |
|---|---|---|---|---|---|
| `users` | `email`, `password_hash`, `created_at` | Pessoal | autenticacao e controle de conta | execucao de contrato | conta ativa + prazo legal |
| `templates` | `name`, `fields`, `file_path` | Pessoal indireto | configuracao de documentos do usuario | execucao de contrato | enquanto ativo |
| `spreadsheets` | `file_path`, `columns`, `row_count` | Pessoal/Sensivel (conteudo do arquivo) | importacao de dados para geracao | execucao de contrato | 180 dias |
| `mappings` | `map` | Pessoal indireto | associacao planilha-template | execucao de contrato | enquanto fluxo ativo |
| `reports` | `patient_data`, `file_path`, `status` | Sensivel | emissao de laudos | tutela da saude/contrato | 365 dias |
| `editor_drafts` | `patients`, `selected_index` | Sensivel | continuidade de revisao no editor | execucao de contrato | 30 dias sem uso |

## Arquivos em storage

| Categoria | Origem | Conteudo | Classificacao | Retencao inicial |
|---|---|---|---|---|
| `template_drafts` | upload em `/modelo/processar-upload` | DOCX temporario | Pessoal/Sensivel (depende do arquivo) | ate 7 dias |
| `templates` | salvamento final de modelo | DOCX de modelo | Pessoal indireto | enquanto ativo |
| `spreadsheets` | upload em `/planilha/upload` | XLSX com pacientes | Sensivel | 180 dias |
| `reports` | geracao em `/laudo/gerar` e `/laudo/lote` | DOCX final | Sensivel | 365 dias |
| `extractions` | upload em `/extracao/processar` | DOCX para extracao | Sensivel | ate 7 dias |

## Compartilhamento com terceiros

| Terceiro | Dados enviados | Finalidade | Observacao LGPD |
|---|---|---|---|
| API de IA (Anthropic) | texto de laudo e campos solicitados | extracao inteligente em `/extracao/processar` | requer clausulas contratuais, base legal e transferencia internacional conforme art. 33 |

## Medidas tecnicas ja aplicadas (fase 2)

- segredo JWT obrigatorio e minimo de 32 caracteres.
- validacao de upload por extensao, MIME, estrutura ZIP e limites anti-bomba.
- mitigacao de path traversal em resolucao de arquivos do storage.
- padronizacao de erros sem vazamento de detalhes internos.
