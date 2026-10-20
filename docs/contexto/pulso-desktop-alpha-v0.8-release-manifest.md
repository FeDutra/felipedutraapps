# PULSO Desktop Alpha v0.8 — manifesto de release

Data de convergência: 20/10/2026

## Fonte

- base canônica: `122025308` (`origin/main`);
- branch de oficina: `feature/pulso-core-alpha-v0.8`;
- marco original integrado: `17adabff5`;
- Core vendorizado: `cfb441091cd048bc1e50aad2ec22ba65f97c12c0`;
- bundle canário: `PULSO Next Preview`;
- identificador: `com.felipedutraapps.pulso.next-preview`;
- versão: `0.8.0`;
- arquitetura: `x86_64-apple-darwin`.

## Provas reproduzidas no VPS

- `npm run pulso:alpha:verify`: 24/24 testes;
- `npm run build`: 34 rotas geradas;
- `cargo check` com sidecars macOS removidos apenas do manifesto de validação:
  concluído;
- aviso Rust herdado: `tauri_plugin_shell::Shell::open` depreciado;
- checagem TypeScript global: 46 erros herdados da `origin/main`, zero erro
  restante nos módulos novos do Core e no `SecondaryChatPane` convergido.

## Estado dos cinco planos

| Plano | Estado |
|---|---|
| Notion | ainda descreve até v0.6/v0.7; atualização pendente após SHA final |
| Git | oficina local limpa sobre `origin/main`; remoto e tag pendentes |
| Firebase | produção legada preservada; nenhum deploy deste marco |
| CI nativo | workflow criado; execução depende de branch remota |
| Aplicativo instalado | nenhum bundle v0.8 instalado ou aceito |

## Bloqueadores de publicação

1. credencial de provider em texto claro na configuração efetiva de Functions;
2. branch e Core-fonte ainda não publicados em remoto;
3. workflow nativo ainda não executado para o SHA final;
4. ausência de assinatura/notarização;
5. teste humano dentro do WebView instalado ainda pendente;
6. voz Desktop continua sendo uma fronteira legada e não constitui ainda voz
   soberana do Core;
7. anexos permanecem bloqueados no caminho soberano.

## Critério para chamar de Alpha disponível

Somente após reconciliar Notion, SHA/tag/remoto, artefato CI, hash do bundle e
aplicativo instalado; então provar dentro do WebView:

`HOME → sessão → provider → mensagem → streaming → cancelamento/retomada → reinício`.

Até lá, o estado correto é **candidata em preparação**, não entregue.
