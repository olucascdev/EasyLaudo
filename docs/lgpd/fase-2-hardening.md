# Fase 2 - Hardening Tecnico (P0)

## Controles implementados

- **Sessao e segredo**
  - `JWT_SECRET` deixou de ter fallback inseguro.
  - validacao de configuracao no startup exige segredo com no minimo 32 caracteres.
  - validacao de `COOKIE_SAMESITE` e coerencia com `COOKIE_SECURE`.

- **Erros e vazamento de informacao**
  - excecoes inesperadas retornam mensagem generica ao cliente.
  - excecoes tecnicas ficam apenas em log do servidor.
  - geracao de laudo e extracao deixaram de expor detalhes internos no payload de erro.

- **Upload seguro (DOCX/XLSX)**
  - limite de tamanho por arquivo (`MAX_UPLOAD_BYTES`).
  - validacao de tipo/estrutura para DOCX e XLSX.
  - protecao contra zip bomb:
    - maximo de entradas compactadas,
    - tamanho total descompactado,
    - razao maxima de compressao.
  - limite de quantidade de arquivos por lote de extracao (`MAX_EXTRACTION_FILES`).

- **Storage**
  - resolucao de caminho agora impede path traversal e caminho absoluto fora da raiz.

- **Gateway (Nginx)**
  - headers basicos de seguranca aplicados.
  - limite de corpo de requisicao em 15 MB.

## Arquivos alterados

- `apps/api/main.py`
- `apps/api/services/auth_service.py`
- `apps/api/services/storage_service.py`
- `apps/api/services/upload_security_service.py`
- `apps/api/routers/modelo.py`
- `apps/api/routers/planilha.py`
- `apps/api/routers/extracao.py`
- `apps/api/routers/laudo.py`
- `apps/api/.env.example`
- `docker-compose.yml`
- `nginx.conf`

## Variaveis de ambiente novas/revisadas

- `JWT_SECRET` (obrigatoria, >= 32 chars)
- `COOKIE_SECURE` (recomendado `true` em producao)
- `COOKIE_SAMESITE` (`lax`, `strict` ou `none`)
- `MAX_UPLOAD_BYTES` (padrao `15728640`)
- `MAX_ZIP_FILES` (padrao `1000`)
- `MAX_ZIP_UNCOMPRESSED_BYTES` (padrao `104857600`)
- `MAX_ZIP_COMPRESSION_RATIO` (padrao `100`)
- `MAX_EXTRACTION_FILES` (padrao `25`)

## Validacao recomendada imediata

- subir a API com configuracao valida e confirmar startup sem erro.
- testar upload DOCX/XLSX valido e invalido.
- testar tentativa de payload zip bomb.
- validar que erros internos nao aparecem no retorno HTTP.
