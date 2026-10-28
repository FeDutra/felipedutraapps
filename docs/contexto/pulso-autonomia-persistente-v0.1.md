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

Uma autorização resolvida para acesso ordinário a conector vale durante a sessão do
provider. Ela não é reapresentada a cada leitura. A permissão de acesso nunca autoriza
automaticamente uma ação externa sensível.

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
