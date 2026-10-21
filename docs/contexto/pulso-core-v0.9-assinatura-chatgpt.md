# PULSO Core v0.9 — assinatura ChatGPT

Data: 21/10/2026

## Decisão

A primeira conversa de nuvem do Core usa **Sign in with ChatGPT** por meio do
`codex app-server`, não uma chave da OpenAI Platform.

O Codex é um provider substituível. A PULSO continua dona de:

- identidade e Soul da Lótus;
- áreas, sessões, mensagens e memória;
- runs, cancelamento, retomada e recibos;
- seleção de contexto e proveniência.

## Fronteira

- binário oficial fixado: `@openai/codex@0.163.0-darwin-x64`;
- transporte local: stdio JSONL;
- autenticação: navegador oficial do ChatGPT;
- armazenamento: Keychain (`cli_auth_credentials_store = "keyring"`);
- restrição: `forced_login_method = "chatgpt"`;
- execução inicial: thread efêmero, sandbox `read-only`, aprovação `never`;
- credenciais, access tokens e refresh tokens não atravessam a bridge e não
  entram no SQLite, nos eventos, nos logs ou no bundle.

Cada perfil possui `CODEX_HOME` próprio. O Codex deriva a entrada do Keychain
do caminho canônico desse diretório, permitindo isolamento posterior entre Fe,
Despertar e Mila. A primeira candidata expõe somente `Fe · pessoal`; os demais
perfis dependem da prova física do primeiro login e de troca de contas.

## Persistência

Os threads do Codex são efêmeros. A cada turno, o Core compõe e envia apenas o
contexto selecionado, recebe o streaming e grava a resposta na sessão PULSO.
Remover o provider não apaga nem renomeia a Lótus, a sessão ou o histórico.

## Aceite antes da promoção

1. login abre o navegador oficial e retorna à conta ChatGPT;
2. conta e plano aparecem sem qualquer token;
3. `model/list` retorna apenas modelos disponíveis à assinatura;
4. conversa transmite deltas e persiste uma única resposta da Lótus;
5. cancelamento interrompe o turno sem fallback invisível;
6. reinício mantém o login pelo Keychain e a conversa pelo SQLite;
7. logout remove somente a credencial do perfil ativo;
8. o bundle prova versão, arquitetura e SHA-256 do sidecar Codex.

## Estado

Implementado e provado no VPS por testes de protocolo. O login humano e o
aceite dentro do WebView instalado permanecem pendentes de computador
explicitamente selecionado.
