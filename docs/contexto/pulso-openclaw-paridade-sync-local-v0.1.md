# PULSO · Paridade OpenClaw e sincronização local-first v0.1

Data do inventário: 23/10/2026  
Baseline instalada: `726ecb3124759dfebafa8394296139c21d4b9803`

## Decisão

A PULSO incorpora as capacidades úteis da OpenClaw sem depender da OpenClaw, de VPS, Firebase ou Firestore para operar. O desenho é local-first: cada Mac mantém seu próprio Core, SQLite, identidade de instalação, credenciais locais e capacidade de funcionar isoladamente.

Sincronização não significa copiar um SQLite vivo nem espelhar `~/.openclaw`. Significa replicar eventos imutáveis, conteúdo versionado e artefatos explícitos entre dispositivos pareados. Segredos, cookies, tokens, bancos de sessão e estados transitórios permanecem locais.

## Inventário factual da OpenClaw

### Patrimônio ativo

- 11 agentes configurados: Lótus principal, FORMA, RITMO, ESTRUTURA, VERBO, VÍNCULO, VETOR, LASTRO, TRAMA, Lótus pública e Lótus de atendimento CRM.
- 4 diretórios de agente não configurados ou experimentais: `codex`, `lean`, `openclaw` e `prumo`; além de workspaces históricos como `despertar` e `jorge`, que exigem classificação antes de promoção.
- 701 arquivos no diretório soberano de sessões do agente principal, cerca de 204 MB; os demais agentes configurados não mantêm arquivos próprios nesse diretório. Há ainda 248 arquivos na árvore de memória do workspace. Uma busca bruta por qualquer pasta chamada `sessions` encontra também dependências e arquivos de projeto e não deve ser usada como contagem de sessões reais.
- 67 skills autorais/operacionais nas raízes canônicas atuais: 13 no workspace, 51 na oficina de skills e 3 no diretório geral. Os 6.941 `SKILL.md` encontrados no universo OpenClaw incluem caches e catálogos de plugins e não representam 6.941 capacidades autorais.
- 111 automações no inventário completo do scheduler: 42 habilitadas e 69 desabilitadas. Habilitada não significa automaticamente vigente; mandatos, redundâncias e contratos antigos ainda precisam ser classificados antes de virar scheduler nativo.
- canais ativos configurados: PULSO/Matrix, WhatsApp e Telegram.
- plugins de runtime configurados: OpenAI, Anthropic, Google, Microsoft, Ollama, Codex, browser, Matrix, WhatsApp, Telegram, Deepgram, Comfy, Vydra e pareamento de dispositivo.
- modelos/perfis em uso ou disponíveis: OpenAI, Claude, Gemini e Ollama local, com políticas de fallback e perfis de autenticação.
- capacidades operacionais: sessões, memória semântica, arquivos, navegador, mídia, nós físicos, ferramentas, apps/MCP, cron/heartbeat, mensagens, aprovações, TTS, portais e auditoria.

### Ruído que não deve ser migrado como produto

- caches de marketplaces e plugins;
- `node_modules`, ambientes virtuais e binários recompiláveis;
- bancos de navegador, cookies e perfis autenticados;
- arquivos temporários, sessões internas descartáveis e logs de execução sem valor histórico;
- backups duplicados e jobs desativados sem mandato vigente;
- configurações contendo tokens ou segredos;
- o banco interno ou diretório de configuração da OpenClaw como unidade bruta.

## Estado real da PULSO

| Domínio | Estado | Evidência atual | Falta material |
|---|---|---|---|
| Core local e event store | pronto | SQLite local, eventos append-only, projeções, integridade e backup | replicação multi-dispositivo |
| Identidade Lótus | pronto | identidade pública + overlay privado local injetado no turno | versionamento sincronizável do conteúdo, sem chave privada |
| Memória privada | parcial forte | recuperação local com proveniência | escrita/curadoria viva, índice incremental e merge entre Macs |
| Conversas/áreas/sessões | pronto local | HOME, áreas, sessões, mensagens e runs no Core | replicação e conflitos multi-dispositivo |
| Modelos/providers | pronto inicial | ChatGPT por assinatura, providers e bindings no Core | roteamento equivalente completo e perfis por agente |
| Ferramentas/apps | pronto inicial | Codex + code-mode-host, Notion e execução local provados | grants nativos por agente, catálogo e recibos na interface |
| Agentes | motor e importação prontos, produto parcial | foundry possui blueprint, revisão, instância, grants, delegação, runs e supervisor; bridge e importador idempotente materializam os 11 agentes pausados | executor real por agente e UI da constelação |
| Skills | parcial | skills podem existir no contexto privado/Codex | registro soberano, versões, dependências e sincronização explícita |
| Automações | ausente no Core | DurableOutbox não equivale a scheduler | scheduler local, triggers, heartbeat, histórico e entrega PULSO |
| Canais | ausente no Core | conversa PULSO local existe | adaptadores WhatsApp/Telegram/Matrix e políticas de entrega |
| Nós e computadores | parcial | identidade de instalação e comandos Tauri locais | registro de dispositivos, roteamento, presença e autorização por nó |
| Sync entre Macs | fundação pronta | identidade Ed25519, confiança/revogação, bundle assinado, importação idempotente e quarentena de conflitos provados em dois bancos locais | cursores incrementais, transporte peer-to-peer e prova física no segundo Mac |
| Segredos | parcial | Keychain para providers | cofre por capacidade, reautorização por Mac e inventário sanitizado |
| Auditoria | parcial forte | eventos e auditoria append-only | recibos de ferramentas, sync e ações externas unificados |
| Browser/mídia/voz | parcial | recursos e sidecars existem | ciclo de vida por demanda, grants e paridade das ferramentas OpenClaw |

## Constelação a importar

### Ativas

1. `main` → Lótus, centro integrador.
2. `designer` → FORMA.
3. `audiovisual` → RITMO.
4. `engenharia-produto` → ESTRUTURA.
5. `comunicacao` → VERBO.
6. `experiencia-cliente` → VÍNCULO.
7. `trafego` → VETOR.
8. `financeiro` → LASTRO.
9. `social-media` → TRAMA.
10. `lotus-conversa` → presença pública/autoral.
11. `lotus-crm-atendimento` → atendimento CRM.

Cada agente será importado como blueprint versionado, com identidade, missão, skills, ferramentas, memória, políticas, provider/modelo, executor, limites, proveniência e estado. Arquivos privados de formação ficam no overlay local e não entram no artefato público.

### Arquivadas até classificação

`despertar`, `jorge`, `codex`, `lean`, `openclaw` e `prumo` entram no inventário como candidatos/legado, nunca como agentes ativos automáticos.

## Fronteiras de sincronização

### Sincroniza

- eventos do domínio PULSO;
- áreas, sessões, mensagens e decisões;
- blueprints, revisões, grants e estado dos agentes;
- memória curada e seus metadados de proveniência;
- skills autorais e manifestos de versão;
- políticas, preferências e layouts explicitamente portáveis;
- tarefas, automações declarativas, outbox e recibos;
- anexos por hash e manifesto, quando marcados para sincronização.

### Permanece local por máquina

- chaves privadas de dispositivo;
- tokens OAuth, cookies, senhas e Keychain;
- permissões do macOS e grants de hardware;
- caminhos absolutos e capacidades físicas específicas;
- processos, locks, PID, cache, WAL/SHM e filas transitórias;
- downloads recompiláveis e dependências de build;
- estado de janela e WebKit.

### Pareamento e confiança

Cada instalação possui identidade Ed25519 própria. O primeiro pareamento exibe fingerprint e exige aceite humano. Depois, bundles são assinados, verificados, idempotentes e auditáveis. Um dispositivo revogado não volta a sincronizar sem novo pareamento.

## Topologia-alvo

```text
MacBook · PULSO Core local ─┐
                            ├─ replicação de eventos assinados ─→ convergência
iMac · PULSO Core local ────┘

Cada lado:
  app + Core + SQLite + Keychain + identidade de dispositivo
  funciona sozinho
  sincroniza quando encontra um par confiável
```

O transporte inicial é uma pasta explícita de bundles ou conexão direta na rede privada. A semântica de sincronização não depende do transporte; Bonjour/LAN, Tailscale ou outro meio pode ser trocado sem alterar o Core.

## Ordem de implementação

1. importar a constelação como blueprints privados versionados;
2. tornar a Foundry acessível pelo bridge e pela Central;
3. criar identidade pública de dispositivo e registro de pares confiáveis;
4. exportar/importar eventos assinados com deduplicação e quarentena de conflitos;
5. provar ida, volta, repetição idempotente e conflito sem perda em dois bancos locais;
6. adicionar transporte peer-to-peer e descoberta quando o segundo Mac estiver aberto;
7. migrar memória curada, skills e automações vigentes;
8. portar canais e ferramentas OpenClaw por adaptadores soberanos;
9. aposentar dependências antigas somente após paridade comprovada.

## Critério de aceite

A PULSO substitui a OpenClaw quando consegue, sem a OpenClaw em execução:

- abrir com identidade e memória locais;
- materializar e supervisionar a constelação;
- executar ferramentas com grants e recibos;
- rodar automações e entregar resultados na PULSO;
- operar canais autorizados;
- manter histórico, projetos e memória;
- sincronizar dois Macs e convergir sem copiar banco vivo nem segredo;
- continuar utilizável quando o outro Mac, a VPS e a internet estiverem indisponíveis, salvo providers e conectores explicitamente remotos.
