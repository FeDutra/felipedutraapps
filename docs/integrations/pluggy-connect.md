# Pluggy Connect na PULSO

## Estado

Widget integrado em `/pulso/conexoes` no código; endpoint Firebase e rewrite implementados. Não publicado, não instalado nos Macs, sem teste credenciado ou prova visual no app. A importação de dados do Core é outro marco: vincular um item não significa que saldos/movimentações estejam importados.

Base desta mudança: `origin/main` em `ba9e9181`. Branch isolada `feat/pluggy-connect-20261123`. O outro marco de ingestão está em `feat/open-finance-personal-20261123` no repositório Core.

## Variáveis no processo do servidor

Fe deve substituir `client_id` e `client_secret` pelos acessos reais no ambiente do próprio servidor. A Lótus não precisa receber nem manipular os valores.

```dotenv
PLUGGY_CLIENT_ID=client_id
PLUGGY_CLIENT_SECRET=client_secret
PULSO_FINANCE_ALLOWED_UIDS=SEU_UID_FIREBASE
```

O backend lê `process.env.PLUGGY_CLIENT_ID` e `process.env.PLUGGY_CLIENT_SECRET`. Nunca usar `NEXT_PUBLIC_` nessas credenciais, não incluí-las no JSX, não versionar `.env`/`.secret.local` e não colar segredo no chat. O UID é o identificador do usuário autenticado na PULSO/Firebase, não o Client ID da Pluggy. A lista limita a emissão de tokens aos usuários da instância financeira pessoal; a falha é explícita na UI se não configurada.

No Firebase local, copiar `functions/.secret.local.example` para `.secret.local` e preencher localmente. Configurar `PULSO_FINANCE_ALLOWED_UIDS` no ambiente do emulador/Functions. Em produção, os dois valores de aplicação devem ser fornecidos por Firebase/Google Secret Manager, vinculados pela opção `secrets` da Function; isso também os disponibiliza em `process.env`. Este marco não cria, lê nem altera segredos reais e não faz deploy.

## Endpoints

A aplicação Next tem `output: export`. Por isso a API é uma Cloud Function, não um Route Handler no bundle estático.

- POST `/api/open-finance/connect-token`: Firebase Bearer token validado (incluindo revogação), UID permitido e não anônimo. Emite token só quando solicitado, com `options.clientUserId` aninhado corretamente. Retorna somente token efêmero e ID do conector MeuPluggy. Limita emissões a uma a cada 10 segundos por usuário.
- POST `/api/open-finance/connections`: confere item na API, `clientUserId` e conector. Persiste vínculo idempotente; proíbe trocar silenciosamente usuário ou escopo. Guarda em coleção administrativa fora das regras amplas de workspace existentes.

O host precisa do rewrite de `firebase.json`. Para um bundle Tauri ou teste local, `NEXT_PUBLIC_PULSO_OPEN_FINANCE_API_BASE` pode apontar para a URL HTTPS da função publicada seguida do prefixo `/api/open-finance`, ou para o emulador local. É configuração pública de endpoint, não credencial. Não publicar antes de configurar os valores, conferir os origins e testar a canária. Não existe Function publicada por este trabalho.

## Widget

- `react-pluggy-connect@2.12.0`, peer `pluggy-js@0.19.3`.
- Importação dinâmica client-only, compatível com exportação estática.
- Abre ao clicar, não durante montagem da página; evita emissão dupla em React Strict Mode.
- Restrito ao conector MeuPluggy, reutilizando a conta em que Nu e Nu Empresas já foram autorizados. Não reabre diretamente o Nubank como se fosse outra integração.
- `includeSandbox={false}`: as conexões informadas são reais. Conectores de teste não aparecem neste fluxo.
- Suporta erro, cancelamento, token expirado, retry de vínculo sem reabrir banco e escopo Pessoal/Empresa.
- Não registra payload bancário no console. A UI diz que o vínculo aguarda sincronização, sem fingir que já há extrato importado.

O escopo é a declaração do usuário, não prova jurídica de titularidade PF/PJ. Se o proxy retornar um item sem `clientUserId` compatível, o endpoint recusa e exige conferência: não associa dados apenas pelo callback do navegador. O comportamento do proxy com itens espelhados precisa ser comprovado na primeira canária real. Nati permanece para etapa posterior, sem presumir que o plano pessoal cobre vários titulares.

## Validação

- `node --test --experimental-strip-types functions/src/openFinance/core.test.ts`: 10 testes de autenticação/autorização, emissão, escopo, ownership, conector, identificadores e erros sanitizados.
- `npm --prefix functions run build`: backend compila.
- `npx tsc -p tsconfig.open-finance.json --noEmit`: módulo frontend e dependências diretas.
- `npm run build`: exportação estática completa compila e inclui Conexões.
- A checagem global `tsc --noEmit` encontra erros em módulos fora deste trabalho (47 no snapshot verificado, incluindo Ateliê/LLM e configuração legada de ESLint no Next). Não foi declarada verde nem corrigida incidentalmente. O build vigente já ignora erros globais; a checagem estrita do módulo financeiro é separada.

Testes do provedor são simulados. Canária real, renderização no WebView, consentimento bancário e persistência em Firestore publicado ainda não comprovados.

## Fontes

- https://docs.pluggy.ai/en/docs/connect-widget/introduction
- https://docs.pluggy.ai/en/docs/security/connect-tokens
- https://docs.pluggy.ai/en/docs/connect-widget/environments
- https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use
