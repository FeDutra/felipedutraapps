# PULSO · Presença distribuída v0.1

## Decisão

A Lótus mantém uma sessão canônica no OpenClaw/VPS e usa o aplicativo desktop como borda local. O Gemini Live pode acelerar escuta, interrupção e narração, mas não recebe autoridade sobre memória, ferramentas ou decisões.

## Papéis

| Camada | Responsabilidade |
|---|---|
| PULSO desktop | microfone, reprodução, Kokoro local, arquivos, apps e execução no Mac |
| PULSO web/mobile | continuidade da mesma conversa e recebimento de resultados |
| OpenClaw/VPS | sessão canônica, identidade, memória, ferramentas e coordenação |
| Gemini Live | streaming de áudio, transcrição, barge-in e narração breve |

## Contrato de continuidade

- Desktop e mobile publicam no mesmo `contextId` e `openclawSessionKey`.
- Cada pedido registra `deviceId` persistente e `deviceClass` apenas para observabilidade; esses campos não criam uma sessão paralela.
- Respostas, progresso e conclusão voltam pelo fluxo canônico de `pulso_requests` e podem ser vistos por qualquer dispositivo conectado.
- Tarefas locais continuam no Mac mesmo quando o celular assume a superfície de conversa; o resultado pertence à sessão da VPS.

## Seleção de transporte

O usuário escolhe `automático`, `gemini live` ou `local` nas configurações de voz.

- `automático`: usa Gemini Live quando o relay está configurado; após falhas de reconexão, continua no fluxo turn-based.
- `gemini live`: prioriza o mesmo transporte, preservando o fallback para não derrubar a sessão.
- `local`: usa VAD/MediaRecorder, transcrição HTTP, OpenClaw e Kokoro; no Tauri, Kokoro usa o sidecar local.

O parâmetro `?gemini_live=0|1` permanece como override de diagnóstico.

## Autoridade do Gemini

O prompt do transporte impede respostas substantivas autônomas. Gemini pode:

- reconhecer fala;
- responder socialmente a saudações simples;
- confirmar que o trabalho começou;
- narrar checkpoint ou resultado recebido do OpenClaw.

Gemini não pode inventar fatos, consultar memória, executar ferramentas nem decidir ações sensíveis.

## Degradação

1. Gemini Live tenta reconectar duas vezes.
2. Persistindo a falha, o controlador encerra recursos do streaming.
3. A sessão passa para transcrição turn-based sem sair do modo Presença.
4. No desktop, TTS usa Kokoro local; se o sidecar falhar, o adaptador usa a Kokoro da VPS e depois a voz nativa.
5. Falhas desktop nunca impedem web/mobile de usar a sessão canônica.

## Prova mínima de release

- Gemini Live recebe fala e entrega a intenção ao mesmo `openclawSessionKey`.
- Resultado real volta pelo Firestore e é narrado sem duplicação.
- Interrupção durante a fala funciona.
- Queda do relay conduz ao modo turn-based na mesma sessão.
- PULSO desktop sintetiza Kokoro local; ausência do Mac preserva web/mobile.
- Um pedido iniciado no desktop aparece no celular sem criar outro fio.

