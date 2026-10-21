# Rollback — PULSO Core v0.9: identidade soberana e migração (21/10/2026)

- Baseline de produto: RC4 `7d0904d2e7f9a64af8eb15b88c6d4338fc172a13`.
- Core-fonte: `a7341514c45d03138f033dd73893f74754da855d`.
- Escopo: remoção do runtime legado do Core, identidade versionada da Lótus,
  overlay privado local e importador idempotente com proveniência.
- O snapshot privado e o overlay de identidade não pertencem ao Git.
- Nenhuma migração no banco ativo ou instalação em máquina física faz parte
  deste commit de código.

## Reversão de código

1. Voltar a branch da candidata para a RC4 `7d0904d2`.
2. Restaurar `vendor/pulso-core` a partir do marcador anterior.
3. Reexecutar a suíte Alpha da RC4 e gerar novo bundle Intel rastreável.

## Reversão de dados, quando a migração for promovida

1. Encerrar somente a Preview, nunca a PULSO atual.
2. Preservar o banco migrado como artefato datado; não apagar.
3. Restaurar o SQLite pré-migração a partir do backup verificado.
4. Restaurar o overlay privado anterior, se houver, ou mover o novo overlay
   para quarentena recuperável.
5. Reabrir a Preview e conferir contagens, integridade e recibo do Core.

---

# Rollback — Presença ampliada no iMac (17/10/2026)

- Baseline instalada: `74d028c6`.
- Escopo: agenda por intervalo, leitura recente de WhatsApp via `wacli`
  somente leitura, Apple Music como reflexo local, pulso de trabalho profundo,
  checkpoints narrados e preservação da Presença ao fechar a MESA.
- A gravação comum, o STT local e o Kokoro não são alterados.

## Reversão

1. Antes da instalação, preservar `/Applications/PULSO.app` em bundle datado.
2. Se a candidata falhar, encerrar somente a PULSO e seus `kokoro_runner`,
   restaurar o bundle preservado e reabrir a PULSO.
3. Antes de atualizar o relay, preservar `/opt/pulso-live-voice/quickReadBroker.js`
   e `quickReadCanary.js` com data e SHA-256.
4. Se agenda ou WhatsApp falhar na canária pós-reinício, restaurar apenas esses
   arquivos e reiniciar somente `pulso-live-voice.service`.
5. Não alterar Gateway, Firestore, STT, Kokoro, `wacli-sync` ou credenciais.

---

# Rollback — restauração Gemini Live no Modo Presença (16/10/2026)

- Baseline: `65c70fc8` em `origin/main`.
- Escopo: restaurar Gemini Live como transporte padrão do app Tauri, manter a
  Lótus como única dona cognitiva do turno e substituir o token reutilizável
  embutido por autenticação Firebase assinada e restrita ao usuário de Fe.
- O relay mantém temporariamente o token legado somente para canária e rollback
  do cliente anterior; o novo bundle não contém esse token.
- A gravação comum, seu Gemini de transcrição, STT local e Kokoro não são
  alterados por esta frente.

## Reversão do relay

1. Antes da ativação, copiar `/opt/pulso-live-voice/server.js` para um arquivo
   datado no mesmo diretório e registrar seu SHA-256.
2. Se a autenticação Firebase falhar, restaurar o arquivo datado e reiniciar
   **somente** `pulso-live-voice.service`.
3. Confirmar `/healthz` e executar a canária pelo token legado. Não alterar o
   Gateway, o Operator Bridge, o STT local ou o Kokoro.

## Reversão do aplicativo

1. Preservar o bundle atual do iMac inteiro antes da instalação.
2. Se o Modo Presença não conectar ao Gemini Live, restaurar esse bundle como
   `/Applications/PULSO.app` e reabrir somente a PULSO.
3. A migração de `localStorage` é de execução única e não apaga a escolha
   posterior do usuário; o bundle anterior continua entendendo a preferência
   existente.

---

# Rollback — presença e destino de máquinas na conversa (15/10/2026)

- Baseline: `4a8f2fd6` em `origin/main`.
- Escopo: dois glifos de presença (iMac/MacBook), seletor de destino no
  compositor, envelope `executionTarget` nos pedidos e projeção sanitizada dos
  nós pelo Operator Bridge.
- Nenhuma publicação, instalação ou ativação de serviço faz parte do commit de
  código. O bridge existente só deve ser atualizado e reiniciado após
  autorização explícita.

## Reversão

1. Reverter o commit desta frente no repositório `felipedutraapps`.
2. Se o Operator Bridge `0.2.0` tiver sido ativado, restaurar o script anterior
   e reiniciar somente esse serviço supervisionado; não reiniciar o Gateway.
3. Preservar o documento `pulso_operator_runtime/current`: os campos `devices`
   podem permanecer sem afetar clientes antigos.
4. O runtime antigo ignora `executionTarget`, portanto não é necessário apagar
   pedidos históricos.

---

## Release desktop identificável 0.1.1 — 15/10/2026

Baseline: `2916556a` em `origin/main`.

### Escopo

- elevar a versão desktop de `0.1.0` para `0.1.1`;
- anexar ao artefato macOS um manifesto com commit, alvo e hashes SHA-256;
- permitir provar a cadeia commit → DMG → executável instalado.

### Reversão

Reverter somente o commit desta alteração e disparar novamente o workflow
`Build Tauri App` para macOS. O rollback não altera Firestore, Functions,
credenciais, Operator Bridge, Runtime Adapter nem o protocolo de origem já
presente na baseline.

# Rollback — origem autenticada por instalação (15/10/2026)

Baseline: `755bafd2` em `origin/main`.

## Escopo

- assinatura Ed25519 vinculada ao `requestId` para a origem automática do app Tauri;
- identificação visual automática do iMac/MacBook no seletor do compositor;
- nenhuma credencial incorporada ao bundle: a identidade é provisionada no
  diretório local de dados do aplicativo.

## Reversão

1. Reinstalar o artefato Intel correspondente a `755bafd2`.
2. O arquivo `device-origin.json` pode permanecer inerte; a versão anterior não
   o lê. Se for necessário retirá-lo, mover para quarentena, nunca apagar sem
   autorização específica.
3. Reverter o commit desta alteração e publicar novamente Hosting/Tauri a
   partir dos mesmos bytes versionados.

# 15/10/2026 — refinamento visual de presença e destino físico

Baseline: `617aa0d0`.

Escopo: tornar a lateral direita estritamente informativa e não interativa,
reduzir os glifos de iMac/MacBook e substituir toda indicação cromática de
seleção por luminosidade e halo branco. O seletor continua existindo apenas no
compositor, como um único botão que abre uma lâmina mínima sob demanda.

Para reverter somente este refinamento, restaurar os três arquivos abaixo a
`617aa0d0`, reconstruir e republicar o Hosting e gerar novo artefato Intel:

- `src/apps/pulso/components/device/DevicePresenceRail.tsx`
- `src/apps/pulso/components/device/ExecutionTargetSelector.tsx`
- `src/apps/pulso/pages/LivePage.tsx`

Nenhum serviço, pareamento, ID de nó ou regra de roteamento precisa ser
revertido, pois esta alteração é exclusivamente visual e de interação local.

# Rollback — voz comum não bloqueável pela camada de recuperação (14/10/2026)

- Baseline instalada: `ad37d3e4` em `main`.
- Motivo: o áudio era preservado, porém um erro de journal ou a trava global de
  `isTyping` ainda podia abortar a transcrição/entrega de um turno de voz já
  capturado.
- Correção: atualizações do journal passam a ser auxiliares e nunca bloqueiam
  transcrição ou envio; `recording_once` não herda a trava de envio manual de
  texto; STT local recebe um retry idempotente; falha de entrega devolve a
  transcrição ao compositor e mantém o WAV recuperável.
- Fonte instalada: `81b154c7` em `main`.
- GitHub Actions: run `38614350947`, build macOS Intel concluído com sucesso.
- DMG Intel: SHA-256
  `68e4f54eccdf4ab754cd41060b59c375ce82360660abd131f8cd7cd565b3301d`.
- Executável principal instalado: SHA-256
  `dfacf4e8d9fe71b68ab95279c94dc168dd4cf882b4afccb98a38124f57e6c9a5`.
- Bundle anterior preservado em
  `/Applications/PULSO.rollback-20261014T183944Z-pre-voice-priority.app`.

## Reversão

1. Encerrar somente `/Applications/PULSO.app` e seus `kokoro_runner`.
2. Mover o bundle atual para um caminho datado de contingência.
3. Restaurar
   `/Applications/PULSO.rollback-20261014T183944Z-pre-voice-priority.app` como
   `/Applications/PULSO.app`.
4. Não remover `~/Documents/PULSO/Áudios recuperáveis`.

---

# Rollback — núcleo SISTEMA e operador de aprovações (14/10/2026)

- Baseline reconciliada: `171e8a5e` em `origin/main`, já contendo a correção final da VOZ.
- Escopo de código: navegação reduzida, rota `/pulso/sistema`, projeções Firestore do operador, regras específicas e bridge ainda não ativado.
- Nenhuma rota antiga foi apagada; apenas saiu da navegação principal.
- O Control UI continua sendo a contingência operacional.
- O bridge não deve ser instalado nem iniciado sem autorização explícita.

## Reversão

1. Reverter o commit desta frente ou restaurar `src/app/pulso/layout.tsx` para devolver o menu antigo.
2. Remover a rota `/pulso/sistema` e os arquivos `SystemPage.tsx` e `operatorControlService.ts` se a superfície precisar ser retirada.
3. Reverter apenas os blocos `pulso_operator_*` em `firestore.rules`; as demais regras permanecem como antes.
4. Se o bridge vier a ser ativado depois, parar somente seu serviço supervisionado antes da reversão; não reiniciar o Gateway.
5. Não apagar as coleções `pulso_operator_approvals` ou `pulso_operator_runtime`: elas contêm apenas projeções e recibos, mas devem ser preservadas para auditoria até decisão explícita.

---

# Rollback — gravação de áudio recuperável no app Tauri (14/10/2026)

- Fonte instalada: `ad37d3e4` em `main`.
- GitHub Actions: run `38594650955`, build macOS Intel concluído com sucesso.
- DMG Intel: SHA-256
  `a1c81bcc8585c5fa5ac9a7c847cfb0e7f3e1b2216b90cb3fa788db409d6511fa`.
- Executável principal instalado: SHA-256
  `1125a27502398c24697ced1ec285a3abcc5883a203e19b1fd1f918042942c48f`.
- Bundle anterior preservado em
  `/Applications/PULSO.rollback-20261014T162012Z-pre-audio-recovery.app` e
  `/Applications/PULSO.replaced-20261014T162012Z.app`.
- A gravação comum do desktop agora recebe `recordingId`, grava PCM em blocos
  durante a captura e fecha um WAV em
  `~/Documents/PULSO/Áudios recuperáveis` antes de transcrever.
- No Tauri, a transcrição usa o serviço local por `recordingId`; áudio longo não
  atravessa o WebView nem depende da cota Gemini.
- Serviço STT atualizado: SHA-256
  `dbbdad877bb659807f58cae1f217b4a67c89455025605dff36c7cf9d57a926f4`.
- Script anterior preservado em
  `~/.local/share/hermes-agent-pulso-local/services/pulso_presence_stt_server.py.rollback-20261014T160300Z`.
- Provas: testes Rust do contêiner WAV e proteção de ID passaram; endpoint local
  transcreveu arquivo salvo em 940 ms; path traversal recebeu HTTP 400; após
  reinício real do app, um PCM parcial foi reconstruído como WAV válido e
  marcado `failed`, permanecendo recuperável.

## Reversão

1. Encerrar somente `/Applications/PULSO.app` e seus `kokoro_runner`.
2. Mover o bundle atual para um caminho datado de contingência.
3. Restaurar
   `/Applications/PULSO.rollback-20261014T162012Z-pre-audio-recovery.app` como
   `/Applications/PULSO.app`.
4. Para reverter também o STT, parar `com.pulso.presence-stt`, restaurar o
   script `.rollback-20261014T160300Z` e carregar novamente o LaunchAgent.
5. Não remover `~/Documents/PULSO/Áudios recuperáveis`: ali ficam os brutos do
   usuário e artefatos de recuperação.

---

# Rollback — transcrição local do modo Presença no iMac (14/10/2026)

- Fonte instalada: `67d0bd94` em `main`.
- GitHub Actions: run `38587622942`, build macOS Intel concluído com sucesso.
- DMG Intel: `PULSO_0.1.0_x64.dmg`, SHA-256
  `8465c27cd8364db4c9a26f5cbf23260db73332d0d49bbfcd286325eaaa922af7`.
- Executável principal instalado: SHA-256
  `134c7cfd71d9939cb1df6b4dc73f8d4ecb58b5b4498f07804986f90baa22ba08`.
- Bundle anterior preservado em
  `/Applications/PULSO.rollback-20261014T153128Z-pre-local-stt.app` e
  `/Applications/PULSO.replaced-20261014T153128Z.app`.
- Serviço local: `faster-whisper` `base`, CPU `int8`, persistente e restrito a
  `127.0.0.1:14323`; não usa Gemini nem cota externa.
- LaunchAgent: `~/Library/LaunchAgents/com.pulso.presence-stt.plist`.
- Script do serviço:
  `~/.local/share/hermes-agent-pulso-local/services/pulso_presence_stt_server.py`.
- Ambiente isolado:
  `~/.local/share/hermes-agent-pulso-local/venvs/faster-whisper`.
- Log: `~/Library/Logs/pulso-presence-stt.log`.
- Prova após instalação: áudio WAV real transcrito em `1047 ms`; health e porta
  do serviço confirmados, assim como Kokoro em `127.0.0.1:14321`.

## Reversão

1. Encerrar apenas `/Applications/PULSO.app` e seus processos
   `kokoro_runner`.
2. Mover o bundle atual para um caminho datado de contingência.
3. Restaurar
   `/Applications/PULSO.rollback-20261014T153128Z-pre-local-stt.app` como
   `/Applications/PULSO.app`.
4. Parar o STT local com
   `launchctl bootout gui/501/com.pulso.presence-stt`.
5. Reabrir a PULSO e confirmar o executável e a porta Kokoro. Os arquivos do
   serviço local podem permanecer inertes para uma reversão recuperável.

---

# Rollback — integridade de turnos do modo Presença (14/10/2026)

- Baseline: `16ff1cfb` em `main`.
- Release instalada: `06355f8853665ae5554e6545f931bb76b8642d5e`.
- GitHub Actions: run `38564703482`, job macOS concluído com sucesso.
- DMG Intel: `PULSO_0.1.0_x64.dmg`, SHA-256
  `581617d5a10d8c9156dff8200ebe3e028f54175440d925c9691efcefe4c97997`.
- Executável principal instalado: SHA-256
  `de9408d8cafc1197c2a3f2ee91bbd32a85be06395839ff9ce7398ebba43a62c9`.
- Aplicativo anterior preservado em
  `/Applications/PULSO.rollback-20261014T121406Z.app`.
- A release silenciosa anterior também foi preservada em
  `/Applications/PULSO.rollback-20261014T095137-silent-regression.app`.
- O bundle permanece sem assinatura/notarização, como a release anterior; a
  origem foi validada por run, commit, arquitetura e hashes.
- Escopo: impedir resposta autônoma do Gemini em pedidos operacionais, vincular
  confirmação/checkpoint/resultado ao turno ativo, cancelar de verdade buffers
  de áudio interrompidos e preservar o pedido quando `interrupted` e
  `inputTranscription` chegam juntos ou fora de ordem.
- Reversão de código: reverter somente o commit desta frente e reconstruir o
  aplicativo Intel. Firestore, relay, credenciais, Hermes e Kokoro não mudam.
- Contingência sem reinstalação: selecionar `local — openclaw + kokoro` nas
  configurações de voz.
- A release foi instalada em `/Applications/PULSO.app`; o sidecar Kokoro foi
  reiniciado e provado escutando apenas em `127.0.0.1:14321`.

---

# Rollback — Gemini Live fora da rota ativa de Presença (14/10/2026)

Baseline de código: `1e3fda30` em `origin/main`.

## Escopo

- tornar `turn_based` o padrão seguro do modo Presença;
- usar Gemini Live somente quando escolhido explicitamente como
  `gemini_live` ou por `?gemini_live=1`;
- restaurar no iMac o pipeline canônico Lótus/OpenClaw com reprodução pelo
  sidecar Kokoro local;
- não alterar relay, credenciais, Firestore, Functions ou o bundle instalado.

## Estado local preservado

Antes da troca, o banco LocalStorage do app no iMac foi copiado para:

`/Users/fe/Library/Caches/PULSO/presence-transport-backup-20261014T132258Z`

## Reversão

Para reverter o código, restaurar `1e3fda30` ou reverter apenas o commit desta
alteração. Para reverter somente o iMac, fechar o PULSO e restaurar os arquivos
`localstorage.sqlite3*` do diretório de backup acima. Depois, abrir novamente o
app. Isso devolve `pulso_presence_transport` ao valor anterior (`auto`).

---

# Rollback — captura WAV no modo Presença do Tauri (14/10/2026)

Baseline de código: `2a63a653` em `origin/main`.

## Escopo

- preservar VAD, microfone e ciclo de turnos existentes;
- no Tauri, capturar o áudio do microfone também como PCM mono e enviar WAV
  para transcrição;
- manter MediaRecorder como fallback do navegador;
- evitar MP4 fragmentado do WKWebView, que chegava com bytes ao endpoint, mas
  retornava transcrição vazia e não criava `pulso_request`.

## Reversão

Reverter somente o commit desta correção, recompilar o artefato
`x86_64-apple-darwin` e reinstalar o bundle anterior preservado em
`/Applications/PULSO.rollback-20261014T121406Z.app`. A mudança não altera
Firestore, Functions, relay, credenciais ou dados do usuário.

## Release instalada

- Fonte: `5d6db5d7` em `main`.
- GitHub Actions: run `38576574329`, job macOS concluído com sucesso.
- DMG Intel: SHA-256
  `9b7cb42113a31e1d979099cd39f16081609db895d05976be63e2c27e395b4860`.
- Executável instalado: SHA-256
  `81b52e7ac492d2298511c57cb3a4691ddaa458d978c30356be9abea389124270`.
- Bundle imediatamente anterior preservado em
  `/Applications/PULSO.rollback-20261014T141725Z-pre-wav.app` e também em
  `/Applications/PULSO.replaced-20261014T141725Z.app`.
- A distribuição permanece sem assinatura/notarização; proveniência e
  integridade foram verificadas por commit, run, arquitetura x86_64 e hashes.

---

# Preparação Hermes local para Presença (14/10/2026)

- Baseline do Hermes: `v0.21.6`, perfil único `default`, gateway parado e sem
  modelo padrão configurado.
- Antes da primeira escrita, criar um backup completo em
  `/Users/fe/hermes-backups/pulso-before-presence-20261014.zip`.
- SHA-256 do backup Hermes:
  `53af0c2b95ce0e18a9887705a43f3780b5dce78de1c644a8b4f2a90fed6bde74`.
- O perfil dedicado vive em `/Users/fe/.hermes/profiles/pulso`; ele não clona
  canais, memória, skills, credenciais nem regras do perfil `default`.
- O perfil aponta somente para o Ollama em loopback, mas mantém **zero
  ferramentas habilitadas**. Gateway, cron, canais e Computer Use ficam
  desligados.
- A descoberta de desempenho mostrou que o Hermes exige contexto mínimo de
  64k. No iMac Intel, ele não integra a via rápida; o Tauri usa um broker local
  enumerado e somente leitura, e o Hermes permanece como segunda camada.
- Para reverter o broker, reverter o commit desta frente e reinstalar o bundle
  Intel anterior. O comando `local_presence_read` não cria estado persistente.

## Reversão exata do Hermes

1. Parar qualquer backend do perfil: `hermes -p pulso serve --stop`.
2. Confirmar que não existe processo escutando a porta loopback reservada.
3. Mover `/Users/fe/.hermes/profiles/pulso` para
   `/Users/fe/.Trash/hermes-pulso-rollback-20261014` (não apagar).
4. Se necessário, restaurar o estado anterior com
   `hermes import /Users/fe/hermes-backups/pulso-before-presence-20261014.zip`.
5. A reversão do aplicativo é independente: restaurar o backup datado de
   `/Applications/PULSO.app` criado imediatamente antes da instalação.

---

# Release Tauri — seletor de contas e recência de sessões (12/10/2026)

- Fonte: `8d25116ed1de50212e733d5b5d495f77e4b09c65` em `main`.
- GitHub Actions: run `38282999181` (`Build Tauri App`, job `build-macos`, sucesso).
- Artefato: `pulso-macos-build`; DMG `PULSO_0.1.0_x64.dmg`.
- SHA-256 do DMG: `6e70821a6a6ca148e5331d2a549d8231ae6e7b7e26aef55ed0b57b35bb474057`.
- Arquitetura instalada: `x86_64` para `app` e `kokoro_runner`.
- SHA-256 do executável principal: `643ce0f36d7d7b248943ae176640c0a0fadea9983924078df7603efb73a52d19`.
- SHA-256 do sidecar Kokoro: `820035a374d753195b983c2dc6efb193a1f5b2c488424908e16df8b5ad81f1a3`.
- SHA-256 do modelo Kokoro: `ebef42457f7efee9b60b4f1d5aec7692f2925923948a0d7a2a49d2c9edf57e49`.
- SHA-256 de `voices.bin`: `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d`.
- SHA-256 de `voices.json`: `ff3f0e5cf156088d4847f277e43c49e3248b798b47027d01afd75d78065744df`.
- Instalação anterior preservada em `/Applications/PULSO.rollback-20261012T173533Z.app`.
- Observação de confiança: o bundle CI não possui assinatura de código/notarização; a proveniência foi validada por run, SHA da fonte e hashes do artefato instalado.

## Reversão no iMac

1. Encerrar apenas `PULSO.app` e seus processos `kokoro_runner`.
2. Mover `/Applications/PULSO.app` para um caminho de contingência datado.
3. Restaurar `/Applications/PULSO.rollback-20261012T173533Z.app` como `/Applications/PULSO.app`.
4. Reabrir a PULSO e confirmar processo `x86_64`, porta Kokoro `127.0.0.1:14321` e sessão ativa.

---

# Rollback — confirmação de Correspondências (28/09/2026)

# Rollback — área GUAYI (04/10/2026)

- Notion: enviar à lixeira somente a página `3ef5166d-3105-8147-be04-cfca61cc714c`.
- Firestore: remover `pulso_areas/area_guayi` e `areaConfig/area_guayi`; devolver
  `familia_escola_guayi`, `familia_matriculas-abertas`, `familia_presidencia` e
  `familia_sistema-guayi` para `area_familia`. `familia_laura` não foi alterada.
- Interface: reverter somente o commit do glifo de broto e republicar o Hosting.

---

# Rollback — Navegador interno e âncoras de leitura (04/10/2026)

Baseline: `8de4d646` em `origin/main`.

## Escopo

- reintegrar o Navegador PULSO lateral na MESA, com sessão Chromium isolada,
  espaços, coleções, histórico, busca e páginas em curso;
- preservar o endpoint privado canônico da Tailnet no build desktop;
- aplicar o mesmo controlador de leitura ao chat solo e a todos os painéis
  split;
- abrir conversa lida no fim e conversa não lida no início da primeira
  resposta nova;
- disponibilizar “voltar para a mensagem mais recente” em cada painel.

## Reversão

Reverter os commits desta alteração, executar `npm run build -- --webpack`,
publicar apenas o Firebase Hosting e reinstalar o artefato Intel anterior. A
reversão não altera o runtime isolado do navegador, perfil, cookies, downloads,
Firestore, relay ou Gateway OpenClaw.

---

- Escopo: manter o double opt-in existente e redirecionar confirmações válidas
  para `https://felipedutra.com/correspondencias/obrigado/`; estados de erro,
  expiração e descadastro ficam na landing de Correspondências.
- A função alterada é somente `correspondenceApi`. Firestore, tokens e o segredo
  `RESEND_API_KEY` não mudam.
- Reversão: restaurar o commit `a9510020` para os arquivos de Correspondências,
  recompilar somente a função e publicar com
  `firebase deploy --only functions:correspondenceApi`.
- A página estática de obrigado é revertida separadamente no repositório
  `apps/fe-site`; sua remoção não desativa o double opt-in, apenas deixa o
  redirecionamento final sem destino.

---

# Rollback — Presença + MESA contextual (23/09/2026)

- Escopo: destino geral de área, orçamento de um checkpoint por turno, abertura
  automática de resultados relevantes na MESA e fechamento local por voz.
- Reversão de código: reverter o commit desta frente e refazer o aplicativo
  Intel. A Presença distribuída, a Kokoro e a via rápida de aplicativos ficam.
- Reversão de dados: arquivar a sessão `despertar_geral` caso ela tenha sido
  criada no Firestore; nenhum histórico existente é movido ou apagado.
- Reversão no iMac: encerrar `/Applications/PULSO.app` e restaurar o backup
  `PULSO.backup-before-presence-mesa-*.app` preservado na instalação.

---

# Rollback — Presença distribuída (22/09/2026)

## Roteador cognitivo local e contexto quente

- Escopo: inferência local de sessão antes da fila canônica, cache compacto de
  destinos e metadados de roteamento no pedido.
- Reversão: reverter somente o commit desta camada e refazer o build desktop.
  A via rápida de aplicativos, o Gemini Live, a Kokoro e as sessões canônicas
  permanecem intactos.
- Contingência sem novo build: desativar o roteamento automático na Presença;
  pedidos continuam na sessão que já estiver ativa.

## Sinônimos naturais da via rápida local

- Escopo: remover determinantes e prefixos como `meu`, `aplicativo`, `app de`
  e `programa` antes de resolver o nome exato do aplicativo permitido.
- Reversão: reverter somente o commit dos sinônimos; a via rápida original e
  o restante da Presença permanecem intactos.

## Aplicativo e transporte

- Encerre `/Applications/PULSO.app`, retenha a versão atual e restaure `/Applications/PULSO.backup-20260922-161726.app` como `/Applications/PULSO.app`.
- Sem trocar o aplicativo, selecione `local — openclaw + kokoro` nas configurações de voz ou abra `/pulso/live?gemini_live=0`.
- No código, reverta somente o commit da Presença distribuída; preserve os commits da Kokoro e da ponte de execução local.

---

# Rollback — Modo Presença em tempo real

## Padrão de execução local e correção do Kokoro desktop — 22/09/2026

- Baseline: `6489705d2f2bd2852f6d06765fb69a4a74923073` em `main`.
- Escopo: contrato durável do nó local, gate de release, recursos Kokoro no CI,
  seleção do sidecar no desktop e fallback sidecar → VPS.
- Reversão: reverter apenas o commit desta frente e refazer o build desktop.
  Isso não remove nem altera o nó OpenClaw já instalado no iMac.
- Contingência sem novo build: selecionar `kokoro_http` no app e usar o endpoint
  público da VPS; a web continua independente do sidecar local.

## PULSO Desktop v0.8 — conversa soberana — 20/10/2026

- Baseline original da integração: `de50ab242`.
- Base canônica convergida: `122025308` (`origin/main` em 20/10/2026).
- Fonte vendorizada do Core: commit `cfb441091cd048bc1e50aad2ec22ba65f97c12c0`.
- O bundle de validação continua separado como `PULSO Next Preview` e
  `com.felipedutraapps.pulso.next-preview`.
- Nunca substituir `/Applications/PULSO.app` durante a canária.
- Antes de promover nova Preview, preservar a anterior em backup datado.
- Para reverter o código, usar `git revert <commit-v0.8>` nesta branch.
- Para reverter no MacBook, encerrar e mover apenas
  `/Applications/PULSO Next Preview.app`; não remover o banco nem entradas do
  Keychain sem pedido explícito do Fe.
- O caminho web/Firebase não é publicado nem alterado por este marco.

---

## PULSO Core client canário v0.7 — 19/10/2026

- Baseline visual e funcional: `9add42e76db330db029937f851e4b76f9e1e3274`.
- Branch: `feature/pulso-core-client-v0.7-sparse`.
- O bundle canário usa `PULSO Next Preview` e
  `com.felipedutraapps.pulso.next-preview`; nunca substitui `/Applications/PULSO.app`.
- Dados locais do canário pertencem ao identificador próprio e não compartilham
  o diretório da PULSO vigente.
- Antes da instalação, preservar qualquer `/Applications/PULSO Next Preview.app`
  existente em backup datado.
- Para reverter a oficina, usar `git revert <commit-do-canário>` nesta branch.
- Para reverter no iMac, encerrar e mover somente
  `/Applications/PULSO Next Preview.app`; manter `/Applications/PULSO.app`
  intocada.

---

## Split de até quatro chats — 20/09/2026

- Baseline: `27f8b639bc2adcbd767cc8edd45c41e76a1823b1`
- Escopo: foco automático do compositor, clique esquerdo substitui o painel ativo, clique direito abre novo painel até o limite de quatro.
- Reversão: reverter o commit desta frente e publicar novamente apenas o Hosting do Firebase.

---

Mudança iniciada em 17/09/2026 na branch `feat/pulso-presence-realtime`.

## Escopo

- unificar o ciclo de captura e reprodução do Modo Presença;
- usar Kokoro obrigatoriamente nas respostas de voz;
- evitar reinício do gravador legado após a resposta;
- orientar respostas orais curtas sem retirar contexto da Lótus.

## Reversão

Antes do merge, descarte apenas os arquivos desta branch comparando-os com `main`.
Depois do merge, reverta o commit final desta mudança com `git revert <commit>` e publique novamente o Firebase Hosting.

O runtime da VPS deve ser revertido separadamente caso o adaptador seja alterado; a cópia anterior fica registrada pelo Git do workspace.

---

# Rollback — Inicialização mobile da Lótus Live

Mudança iniciada em 17/09/2026 na branch `fix/pulso-mobile-init-20260917`.

## Escopo

- consolidar a interface mobile mínima sobre a versão atual da `main`;
- impedir que consultas lentas mantenham “Sintonizando” indefinidamente;
- retirar do navegador web a chamada exclusiva do Tauri;
- manter gravação direta com contador e limite de 7 minutos.
- impedir cache de uma hora no HTML da rota limpa `/pulso/live`.

## Backup e reversão

- baseline preservada na branch `backup/pulso-mobile-before-init-fix-20260917` (`74ae899b`);
- antes do merge, comparar ou descartar apenas a branch `fix/pulso-mobile-init-20260917`;
- após merge/deploy, usar `git revert <commit-final>` e republicar apenas o Firebase Hosting;
- esta mudança não altera worker, credenciais, Firestore nem runtime da VPS.
# Rollback — boot mobile Safari (17/09/2026)

Baseline reversível: branch `backup/pulso-before-safari-boot-20260917` no commit `84678c6e`.

Para desfazer somente esta correção após o commit de release:

```bash
git revert <commit-da-correcao-safari>
npm run build
firebase deploy --only hosting
```

Escopo da correção: remover a tela bloqueante de inicialização, manter o
primeiro render idêntico entre servidor e cliente e tornar preferências em
`localStorage` opcionais quando o Safari negar acesso.

---

# Rollback — presença contínua da orbe (19/09/2026)

Baseline reversível: `47d9dd48` em `main`.

## Escopo

- remover o disco preto opaco ao redor da orbe;
- preservar transparência com blur e escurecimento radial difusos;
- manter uma única instância fixa da Lótus entre abertura, repouso, Presença,
  split, Mesa, Ateliê e Estúdio;
- interpolar posição e escala em vez de remontar ou teleportar a orbe;
- registrar o padrão em `docs/contexto/pulso-lotus-presence-standard-v1.md`.

## Reversão

Após o commit desta correção, usar `git revert <commit-da-presenca-continua>`,
executar `npm run build` e republicar somente o Firebase Hosting. A mudança não
altera Firestore, funções, credenciais nem runtime da VPS.

---

# Rollback — coreografia de abertura da Pulso (19/09/2026)

Baseline reversível: `f9bf6a93` para a presença visual; alterações posteriores
de voz e split devem ser preservadas ao reverter.

## Escopo

- esconder validação e hidratação atrás de uma abertura visual limpa;
- separar nascimento, viagem e acomodação da Lótus;
- revelar a interface durante a viagem, sem exibi-la sob a orbe no nascimento;
- substituir a superfície circular de blur por névoa radial sem perímetro.

## Reversão

Reverter apenas o commit final desta coreografia com `git revert <commit>`,
executar `npm run build` e republicar somente o Firebase Hosting. Não há mudança
em Firestore, Functions, credenciais ou runtime da VPS.

### Refinamento contínuo da entrada — 19/09/2026

- as orbes provisórias do Suspense e da autenticação foram removidas;
- nascimento, foco, escala, deslocamento e dissipação usam uma única curva
  `ease-in-out` declarada no CSS;
- a troca entre nascimento e viagem responde ao fim real da animação, com
  cronômetro apenas como proteção de contingência.

Para reverter somente este refinamento, usar `git revert <commit-da-entrada-contínua>`,
reconstruir o frontend e republicar apenas o Firebase Hosting.

---

# Rollback — ritmo de Presença (19/09/2026)

## Escopo

- consolida `progress_update` rápidos em um único checkpoint oral;
- espera 4,5s após a confirmação inicial e 12s entre checkpoints;
- descarta checkpoints pendentes quando o resultado final chega;
- orienta a voz Gemini para uma fala adulta, concreta e não infantilizada.

## Reversão

Reverter somente o commit desta alteração, executar `npm run build` e publicar
apenas o Firebase Hosting. Não altera Firestore, Functions, credenciais ou o
relay da VPS.

### Ajuste de responsividade

- o primeiro checkpoint passa a ser elegível após 3s; os seguintes mantêm 10s
  de distância mínima;
- a Orbe preserva o estado visual de trabalho enquanto a Gemini aguarda o
  retorno do cérebro da Lótus.

---

# Rollback — camadas da Mesa e leitura por voz (20/09/2026)

Baseline reversível: `dc6c012a` em `origin/main`.

## Escopo

- impedir a orbe de cobrir Mesa, menus, drawers e pré-visualizações integrais;
- preservar a mesma instância da orbe, com recuo suave apenas no mobile;
- disponibilizar na Mesa a mesma leitura TTS/Kokoro usada nas mensagens;
- elevar superfícies modais da Pulso acima da camada reservada à orbe.

## Reversão

Reverter somente o commit desta alteração, executar `npm run build` e publicar
apenas o Firebase Hosting. A mudança não altera Firestore, Functions,
credenciais, preferências de voz nem runtime da VPS.

---

# Rollback — Conversas do site na PULSO (29/09/2026)

Baseline: `60fbf7be` na branch `feat/pulso-site-conversations-20260929`,
recomposta sobre `origin/main` (`0be6a108`).

## Escopo

- acrescentar a rota interna `/pulso/conversas` e seu item de navegação;
- ler, dentro da PULSO autenticada, os fios já persistidos em
  `public_conversations` e suas solicitações correspondentes em
  `pulso_requests`;
- registrar apenas o instante interno de leitura no documento da conversa;
- não alterar o contrato, o agente, o token ou a interface pública do site.

## Reversão

Reverter somente o commit desta área, executar `npm run build` e republicar
apenas o Firebase Hosting. A reversão visual não apaga conversas. Se a marcação
de leitura já tiver sido usada, os campos `internalLastReadAt` e
`internalReadBy` podem permanecer inertes nos documentos ou ser removidos em
uma manutenção separada e explicitamente autorizada.

---

# Rollback — camadas do compositor (01/10/2026)

Baseline: `c7d8561d` em `origin/main`.

## Escopo

- separar explicitamente histórico, vidro e controles do compositor;
- fazer o vidro acompanhar a altura total de contexto, anexos, citação e texto;
- manter linha, contexto, texto digitado e botões acima do blur;
- impedir clique através da área protegida para mensagens ao fundo.

## Reversão

Reverter somente o commit desta alteração, executar `npm run build`, publicar
somente o Firebase Hosting e instalar o artefato Intel correspondente ao
commit anterior. Não altera Firestore, Functions, credenciais, áudio ou
runtime da VPS.

## Correção de empilhamento — 02/10/2026

Baseline desta correção: `0ed707e6` em `origin/main`.

- o material deixa de ser pintado no fundo do próprio footer;
- uma placa de vidro isolada ocupa o plano intermediário sobre o histórico;
- todos os filhos do compositor ficam explicitamente acima dessa placa;
- a máscara superior preserva a finalização suave quando o campo cresce.

Para reverter somente esta correção, restaurar `0ed707e6`, executar
`npm run build`, republicar apenas o Firebase Hosting e reinstalar o artefato
Intel correspondente. Nenhuma função, banco, credencial ou serviço é alterado.
# Rollback — confiabilidade de chat, ações e anexos (04/10/2026)

Baseline visual do desktop: `0ed707e6`. Baseline funcional do código:
`eb607da2`.

## Escopo

- ordenar sessões por atividade recente somente dentro de cada área;
- manter horário, copiar e ouvir para mensagens de Fe e Lótus, inclusive split;
- retirar responder e pacote técnico da superfície da conversa;
- renderizar anexos enviados pela Lótus, com prévia de imagem, áudio, vídeo e PDF;
- preservar exatamente o CSS do compositor instalado em `0ed707e6`.

## Reversão

Reverter o commit desta alteração, executar `npm run build`, publicar apenas o
Firebase Hosting e reinstalar o artefato Intel anterior. A reversão do frontend
não remove arquivos já persistidos no Storage nem altera o runtime do relay.

---

# Rollback — encerramento de voz e âncora do split (15/10/2026)

Baseline canônica: `d302d54f` (`origin/main`). O app Intel instalado antes da
troca final deve ser preservado como
`/Applications/PULSO.rollback-before-voice-split-20261015.app` em cada Mac.

## Escopo

- aguardar `MediaRecorder.onstop` antes de desmontar o grafo WebAudio;
- prender `recordingId` e caminho do WAV à instância concreta da gravação;
- impedir sobreposição durante transcrição e usar o gravador real como fonte
  do estado do botão;
- fazer o watchdog de sete minutos parar o gravador capturado pela própria
  closure, sem depender de refs visuais;
- abrir painéis de split na última mensagem e preservar a âncora de leitura
  durante mudanças de largura.

## Reversão

1. reinstalar o bundle preservado acima;
2. publicar novamente o Hosting do SHA `d302d54f`;
3. não remover os arquivos em `~/Documents/PULSO/Áudios recuperáveis` — eles
   continuam sendo a cópia durável das capturas;
4. não alterar nem remover o LaunchAgent `com.pulso.presence-stt`: esta release
   não muda o serviço Whisper local nem reintroduz Gemini no Tauri.

---

# Rollback — gravação comum volta ao Gemini (15/10/2026)

Baseline: `5eca4acd`.

## Escopo

- restaurar no Tauri o contrato histórico da gravação comum com
  `pulsoTranscribe`/Gemini;
- manter PCM/WAV recuperável, `recordingId`, retries e estados de entrega;
- não alterar a Presença/Orbe, que continua como uma arquitetura separada;
- não instalar Whisper nem criar serviço local novo no MacBook.

## Reversão

Reverter somente o commit desta alteração, executar os gates e reinstalar o
bundle Intel de `5eca4acd`. Os áudios em
`~/Documents/PULSO/Áudios recuperáveis` não devem ser removidos. A reversão
não altera Functions, segredos, Firestore nem serviços da Presença.

---

# Rollback — máquina explícita de turnos da Presença (15/10/2026)

Baseline: `a043db43` (`origin/main`).

## Escopo

- acrescentar um núcleo puro e testável para identidade e propriedade do turno;
- correlacionar `turnId → requestId → checkpoint/resultado → narração`;
- impedir que resultado tardio, interrupção ou final de áudio antigo invadam o
  turno corrente;
- integrar a correlação ao `VoiceSessionController` e à resposta assíncrona do
  Firestore sem trocar Gemini, Kokoro, STT, relay ou gravação comum.

## Reversão

Reverter somente o commit desta alteração e restaurar o Hosting/bundle Intel de
`a043db43`. Nenhum banco, áudio durável, segredo, serviço local, relay ou
configuração de transporte precisa ser revertido, porque esta etapa não altera
essas camadas.

---

# Rollback — presença das agentes nas conversas (16/10/2026)

Baseline: `563ae79f` (`origin/main`).

## Escopo

- renderizar mensagens proativas autônomas a partir de `text`/`message`;
- resolver a entidade responsável pela chave canônica `agent:<id>:...`;
- mostrar FORMA, RITMO, ESTRUTURA, VERBO, VÍNCULO, VETOR, LASTRO ou TRAMA
  como autoria visível, sem rotular toda resposta como Lótus;
- indicar a agente presente na sessão principal e nos painéis divididos;
- manter mensagens derivadas de pedidos sem duplicação por `originRequestId`.

## Reversão

Reverter somente o commit desta alteração e publicar novamente o Firebase
Hosting do SHA `563ae79f`. A reversão não muda documentos do Firestore, chaves
de sessão, agentes do OpenClaw, serviços, credenciais ou computadores físicos.

---

# Rollback — captura AudioWorklet da Presença Gemini (17/10/2026)

Baseline: `e0edd3d7` (`origin/main`).

## Escopo

- substituir somente a captura Gemini da Presença de `ScriptProcessorNode`
  por `AudioWorklet`, com PCM16 mono a 16 kHz em frames de 20 ms;
- preservar integralmente a gravação comum e a captura turn-based local;
- registrar um journal circular local apenas com fases, tempos, bytes e IDs;
- eliminar o transporte `auto` e qualquer fallback silencioso para o caminho
  local pós-Gemini;
- preparar o contexto de reprodução ainda no gesto que abre a Presença.

## Reversão

1. reinstalar o bundle Intel preservado antes da troca em cada Mac;
2. republicar o Hosting do SHA `e0edd3d7` somente se a web também tiver sido
   promovida;
3. não alterar nem reiniciar `pulso-live-voice.service`: esta correção não muda
   o relay, a chave Gemini ou a autenticação Firebase;
4. não remover áudio recuperável nem serviços Kokoro/Whisper: a gravação comum
   e o modo local não fazem parte desta alteração.

---

# Rollback — turno de voz canônico e resposta imediata (17/10/2026)

Baseline: `5dd72c76` (`origin/main`).

## Escopo

- registrar toda fala da Presença como pedido canônico e pesquisável no chat;
- identificar visualmente a entrada como `fê · voz` sem criar um documento
  paralelo para cada turno;
- tocar em streaming a confirmação curta do Gemini enquanto a Lótus executa;
- reduzir o fechamento do turno para 600 ms de silêncio, preservando pausas
  naturais;
- impedir que resultado social, duplicado ou tardio caia no TTS local;
- fechar o turno mesmo quando `inputTranscription` chega depois de
  `turnComplete`, com recibos do despacho canônico;
- acrescentar uma canária PCM de ponta a ponta sem armazenar áudio ou texto.

## Reversão

1. reinstalar no iMac o bundle preservado antes da troca;
2. republicar o Hosting do SHA `5dd72c76` se a web também tiver sido promovida;
3. não alterar nem reiniciar `pulso-live-voice.service`: esta alteração usa o
   protocolo já aceito pelo relay ativo;
4. preservar Firestore e histórico: os pedidos de voz já registrados continuam
   sendo mensagens canônicas válidas após a reversão;
5. não tocar na gravação comum, Kokoro ou Whisper, pois estão fora do escopo.

---

# Rollback — despacho canônico dedicado da Presença (17/10/2026)

Baseline: `e59c9cb8` (`origin/main`).

## Escopo

- separar o turno de voz do compositor de texto, anexos e replies;
- criar o pedido pesquisável diretamente pela persistência canônica já usada
  pela PULSO;
- manter o roteamento cognitivo como otimização não bloqueante: em caso de
  falha, preservar a sessão ativa e enviar o pedido;
- registrar estágio e código seguro quando o despacho falhar;
- não alterar captura, Gemini Live, relay, gravação comum, Kokoro ou Whisper.

## Reversão

1. reinstalar no iMac o bundle preservado antes desta troca;
2. republicar o Hosting do SHA `e59c9cb8` se a web também tiver sido promovida;
3. não alterar nem reiniciar `pulso-live-voice.service`, pois o protocolo de
   áudio não muda nesta correção;
4. preservar os pedidos de voz já criados no Firestore;
5. manter MacBook e iPhone fora da reversão desta etapa.

---

# Rollback — três velocidades do Modo Presença (17/10/2026)

Baseline: `06455c39` (`origin/main`).

## Escopo

- classificar cada fala em social, reflexo local, consulta rápida ou trabalho
  profundo por regras estreitas e testáveis;
- executar abertura de aplicativo antes do registro assíncrono no Firestore;
- consultar a agenda de hoje por um broker tipado no relay, sem OpenClaw,
  mouse, teclado ou tomada de foco;
- manter conversas sociais pesquisáveis sem abrir trabalho profundo;
- tocar uma assinatura sonora local quando o pedido entrar na Lótus;
- preservar a gravação comum, o pipeline de reunião, Kokoro e Whisper.

## Reversão

1. restaurar `/opt/pulso-live-voice` pelo backup criado imediatamente antes da
   ativação e reiniciar apenas `pulso-live-voice.service`;
2. reinstalar no iMac o bundle preservado antes da troca;
3. republicar o Hosting do SHA `06455c39` se a web também tiver sido promovida;
4. não apagar registros `local_interaction`: continuam sendo histórico válido;
5. não tocar no MacBook nem no iPhone nesta etapa.

---

# Rollback — autoridade única de voz e intenção analítica (17/10/2026)

Baseline: `c46012ea` (`origin/main`).

## Escopo

- impedir o listener global de entregar ao Kokoro mensagens já narradas pelo
  Gemini no Modo Presença;
- preservar registro imediato e pesquisável com rótulos `Fê · voz` e
  `Lótus · voz`;
- garantir que analisar, priorizar, organizar, comparar, recomendar ou planejar
  suba para trabalho profundo, mesmo quando a frase também cita agenda;
- não alterar áudio, relay, credenciais, gravação comum ou conectores.

## Reversão

1. reinstalar no iMac o bundle `c46012ea` preservado antes da troca;
2. republicar o Hosting do SHA `c46012ea` se a web também tiver sido promovida;
3. não reiniciar `pulso-live-voice.service`, pois o relay não muda;
4. preservar todos os registros de voz já gravados no Firestore;
5. manter MacBook e iPhone fora da reversão desta etapa.
