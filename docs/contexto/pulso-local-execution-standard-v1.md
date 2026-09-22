---
title: PULSO · padrão de execução local e resposta rápida v1
---

# PULSO · padrão de execução local e resposta rápida v1

## Contrato arquitetural

1. **PULSO** recebe intenção, mostra presença, progresso, aprovação e entrega.
2. **Lótus/OpenClaw na VPS** preserva contexto, memória, ferramentas, política e
   raciocínio. É o cérebro canônico mesmo quando a entrada vem por voz.
3. **iMac** executa trabalho local quando estiver ligado e elegível: arquivos,
   CLI, navegador, apps, render, captura e interface gráfica.
4. O nó local é uma capacidade opcional. Sua ausência nunca pode bloquear chat,
   Notion, WhatsApp, voz web ou outras funções que possuam rota remota.

Não transformar `LOCAL_ACTION` em um segundo protocolo remoto. O canal canônico
de execução local é o nó OpenClaw, com identidade, aprovação, retorno e logs.

## Negociação de capacidades

Antes de despachar uma ação local, confirme:

- nó `paired`, `connected` e `approved`;
- comando ou app necessário presente;
- permissão macOS específica: Screen Recording para enxergar; Accessibility e
  Automation para operar; Microphone para voz;
- destino de escrita e política de confirmação compatíveis com a ação;
- fallback quando o Mac ou o recurso estiver indisponível.

Capacidade não comprovada é indisponível. Uma captura de tela não comprova
clique; um processo aberto não comprova que o sidecar está saudável.

## Roteamento por custo e natureza

| Trabalho | Rota preferida | Tokens de LLM |
|---|---|---|
| interpretar pedido, decidir, escrever, revisar | OpenClaw/Lótus | sim |
| Notion e WhatsApp por API/CLI existente | VPS | só na interpretação |
| Antigravity e código | coordenador na VPS; execução local quando exigir macOS/app | conforme o raciocínio |
| copiar, mover, converter, renderizar, abrir app | iMac/CLI | não por si |
| ler captura, criticar design, diagnosticar falha | OpenClaw/Lótus | sim |
| operação visual sem API | iMac/UI | sim para planejamento e leitura; não para o clique em si |

Mover uma automação para o Mac reduz rede e trabalho mecânico, mas não reduz os
tokens necessários para compreender ou julgar. Mantenha integrações canônicas
de WhatsApp e Notion na VPS; use o Mac apenas quando a sessão local, um arquivo
ou aplicativo forem realmente necessários.

## Convivência com o uso humano do iMac

- Shell, render, conversão, leitura de arquivo e processos em background podem
  rodar enquanto Fê usa outros aplicativos, respeitando CPU, GPU, disco e áudio.
- Automação por API, MCP ou arquivo pode operar sem tomar foco.
- Mouse, teclado, menus, arraste e atalhos disputam a mesma sessão gráfica.
  Antes deles, avise que a tela será usada; durante a janela, Fê não deve mexer;
  ao terminar, devolva foco e confirme liberação.
- Não automatize silenciosamente uma interface enquanto Fê trabalha nela.
- Para tarefas longas, prepare em background e reserve a interface somente para
  revisão ou gesto que não exista por API/CLI.

## Resposta rápida e voz

O caminho diário deve separar **presença imediata** de **trabalho completo**:

1. Gemini Live mantém a sessão de áudio e responde imediatamente com uma frase
   curta, sem inventar conteúdo.
2. Pedidos factuais ou operacionais seguem ao fluxo canônico da Lótus.
3. Ações simples e determinísticas usam despacho direto após classificação de
   risco; tarefas longas recebem confirmação e progresso sem bloquear a voz.
4. O resultado retorna à mesma sessão e é narrado de forma breve.

Gemini Live não recebe autoridade paralela sobre Notion, WhatsApp ou o Mac. Ele
é ouvido e boca; OpenClaw continua cérebro e executor político.

## Voz e fallback

- **Gemini Live:** conversa em tempo real do modo Presença.
- **Kokoro sidecar:** TTS local preferido no app desktop quando saudável.
- **Kokoro VPS:** fallback de TTS para desktop e rota principal da web.
- **Voz nativa:** último fallback, nunca substituição silenciosa quando o modo
  exigir identidade vocal Kokoro.

O build desktop deve baixar e empacotar `kokoro-v0_19.onnx`, `voices.bin` e o
sidecar da arquitetura correta. A inicialização deve provar a porta local antes
de selecionar o sidecar.

## Gate obrigatório de release

Quando a mudança tocar estas camadas, valide no artefato final:

1. PULSO abre e conversa com o Mac desligado.
2. Nó online é detectado sem depender de nome fixo na UI.
3. Uma ação local reversível retorna sucesso e aparece na interface.
4. Captura e controle de interface são testados separadamente.
5. Operação por mouse/teclado respeita a janela de exclusividade.
6. Kokoro local responde; se falhar, Kokoro VPS assume; falha total fica visível.
7. Gemini Live confirma rápido e devolve o pedido ao orquestrador canônico.
8. Nenhuma mensagem, publicação, exclusão, credencial ou decisão financeira é
   executada sem a confirmação exigida.
9. Cache, rota web, desktop Intel e estado offline/online são verificados.
10. O relatório de release declara explicitamente o que não foi testado.

## Evidência operacional atual · 22/09/2026

- iMac Intel conectado como nó persistente do OpenClaw pela tailnet.
- Shell, arquivos, abertura de apps, tela, OCR, teclado e clique comprovados.
- Open Design e Kdenlive auditados; render MLT/FFmpeg comprovado.
- Kokoro VPS saudável. O app desktop instalado contém o sidecar, mas seu build
  não empacotou o modelo e `voices.bin`; por isso a voz local não inicia.
- Gemini Live via relay VPS já foi validado em uso real, mas continua opt-in.
