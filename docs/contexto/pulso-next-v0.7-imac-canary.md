# PULSO Next v0.7 — canário nativo no iMac

Data: 19/10/2026  
Estado: instalado como Preview isolada; não promovido à PULSO vigente

## Corte

- A casca visual e os contratos de interação continuam sendo os da PULSO vigente no commit canônico `9add42e7`.
- `/pulso/live` é a URL inicial do aplicativo nativo.
- `LivePage`, MESA, split, menus, glifos, orbe e gestos não foram redesenhados.
- O PULSO Core entra por baixo da casca via bridge Tauri e sidecar Node persistente.
- A confirmação técnica é invisível e não altera layout: bootstrap do Core, SQLite local e estado `sr-only`.

## Provas

- JavaScript/fronteira: 11/11 testes aprovados no iMac.
- Rust: 6/6 testes aprovados para `x86_64-apple-darwin`.
- Next/Tauri release: build concluído.
- Aplicativo e sidecar: Mach-O `x86_64`.
- Assinatura ad hoc: `codesign --verify --deep --strict` aprovado.
- SQLite: `pragma integrity_check = ok`.
- Bridge em execução: o WebView iniciou o sidecar empacotado usando o diretório de dados exclusivo da Preview.
- Bundle isolado: `com.felipedutraapps.pulso.next-preview`.
- PULSO vigente preservada: `com.felipedutraapps.pulso` continuou instalada e em execução.

Artefato assinado da Preview no iMac:

- `/Users/fe/.openclaw-builds/PULSO-Next-Preview-0.7.0-imac-canary-signed.zip`
- SHA-256: `c6ff3a3b46af3ed7f7f00ecf9870071fac9267f09f234255e8711cfc1c0fbf62`

## Limite de validação visual

O nó remoto do iMac não anuncia `computer.act` nem `screen.snapshot`, e o macOS recusou `screencapture` para o display da sessão. Portanto, nenhuma captura visual foi produzida e não há alegação de equivalência visual baseada em screenshot remoto.

O recibo `core-canary-rendered.json` é agendado após o próximo frame de pintura. Como a sessão gráfica remota deixou o WebView em segundo plano/suspenso, o frame não foi emitido durante a validação automatizada. Isso não foi substituído por um recibo falso. A prova disponível cobre rota `/live`, WebView, Tauri, sidecar, bootstrap e banco; a inspeção ocular permanece pendente quando houver sessão gráfica ativa.

## Reversão

- A Preview anterior está preservada em `~/.openclaw-backups/pulso-next-preview/`.
- Para reverter, encerrar apenas `PULSO Next Preview`, mover `/Applications/PULSO Next Preview.app` para o backup e restaurar a cópia anterior.
- Não alterar `/Applications/PULSO.app` nem seu diretório de dados.

