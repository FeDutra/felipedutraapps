# PULSO · autonomia persistente · v0.1

## Princípio

A sessão humana normal recebe as mesmas capacidades comprovadas nas canárias. A
canária prova uma capacidade; não é requisito para ela continuar existindo.

OpenClaw permanece operador subordinado para capacidades já maduras no ecossistema.
PULSO conserva sessão, contexto, grants, decisão humana, progresso e recibos.

## Matriz de consequência

| Classe | Exemplos | Decisão humana |
|---|---|---|
| leitura | Notion, Drive, Gmail, Agenda, WhatsApp, estado dos Macs, lista de jobs | não |
| oficina privada | arquivos dentro da oficina, análise, minuta, rascunho, memória, organização | não |
| escrita reversível autorizada | página de auditoria, rascunho Gmail, atualização interna explícita | não |
| comunicação externa | enviar WhatsApp/e-mail, responder pessoa, publicar em canal | sim, imediatamente antes do envio |
| compromisso externo | criar/alterar reunião, convite ou prazo para terceiros | sim |
| destruição | apagar, revogar, remover material ou rotina | sim |
| segurança e dinheiro | credencial, permissão, pagamento, transferência | sim |

O grant persistente do agente autoriza o acesso ordinário ao conector sem criar uma
decisão humana. Verificação de credencial continua humana. A permissão de acesso nunca
autoriza automaticamente uma ação externa sensível.

## Paridade OpenClaw → PULSO

| Capacidade madura | Executor | Superfície PULSO |
|---|---|---|
| WhatsApp: histórico/contatos/anexos | `wacli` sincronizado na VPS | ferramenta dinâmica de leitura |
| WhatsApp: minuta | PULSO Core | ferramenta local, `sent=false` |
| WhatsApp: envio | canal oficial OpenClaw | ferramenta dinâmica com decisão pré-efeito |
| Macs: presença/estado | Gateway `node.list` | ferramenta dinâmica de leitura |
| Jobs: listar/consultar | Gateway `cron.list` | ferramenta dinâmica de leitura |
| Jobs: criar/editar/rodar | Gateway `cron.*` | ferramenta dinâmica operacional; efeito externo continua governado |
| Notion/Google | conectores do perfil Codex | autorização automática para leitura e oficina; decisão por consequência |

## Persistência

- O operador roda supervisionado na VPS e reinicia com o sistema.
- O endpoint é restrito à Tailnet e autenticado por token de alta entropia.
- Cada Mac guarda o pareamento no Chaves do macOS.
- O Tauri hidrata o pareamento ao nascer; fechar e reabrir a PULSO não perde as
  ferramentas.
- O token nunca é persistido no SQLite nem projetado em recibos.

## Critérios de aceite

1. Reabrir a PULSO e encontrar WhatsApp/jobs/dispositivos disponíveis sem terminal.
2. Ler Notion, Google e WhatsApp sem decisões humanas repetidas.
3. Tentar enviar WhatsApp e parar em uma única decisão contextual antes do efeito.
4. Reabrir a sessão e ver recibos compactos, sem argumentos ou segredos.
5. Sessões técnicas permanecem auditáveis, mas não poluem a navegação cotidiana.
6. iMac e MacBook recebem o mesmo bundle Intel e o mesmo contrato de operador.

## Homologação no iMac · 28/10/2026

- commit instalado: `6eeadff2e3b06660fbc5b53e189678b65cab0a81`;
- CI Intel: run `40698270619`;
- manifesto: bundle `com.felipedutraapps.pulso.next-preview`, alvo
  `x86_64-apple-darwin`;
- 96/96 contratos;
- operador persistente respondeu com WhatsApp, Macs e jobs após reabertura;
- 11 agentes e 89 grants ativos;
- sessão humana `PULSO CORE · CONSTRUÇÃO`: Notion, Drive, Gmail, Google Calendar
  direto, WhatsApp via `wacli` e jobs concluíram com 6 recibos, 14 eventos de
  progresso e 0 decisões humanas;
- tentativa de envio WhatsApp gerou uma única decisão `external_action`, recusada
  antes do efeito; busca externa no `wacli` confirmou 0 mensagens com o marcador;
- SQLite vivo e snapshot pré-corte retornaram `ok`;
- rollback completo preservado no iMac.

O MacBook permanece na versão anterior enquanto estiver em uso e com baixa margem de
disco. A sincronização do bundle é uma promoção física pendente; os eventos e grants
continuam sincronizáveis pelo Core.
