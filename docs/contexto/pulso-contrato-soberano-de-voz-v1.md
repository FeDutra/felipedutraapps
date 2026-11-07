# PULSO · contrato soberano de voz v1

## Objetivo

Reduzir latência percebida sem entregar ao renderer autoridade sobre a fala da
Lótus. A resposta falada deriva de frases canônicas já comprometidas.

## Regras incorporadas

- Cada turno possui identidade e cronologia próprias.
- Respostas são divididas em frases imutáveis antes da síntese.
- Cada reprodução pertence a uma época; barge-in invalida a época anterior.
- Áudio antigo não pode reaparecer por callback tardio.
- Interromper a narração não apaga texto, ação ou resultado canônico.
- Recibos medem fases e latência sem guardar conteúdo, áudio ou transcrição.
- Gemini, Kokoro e futuros renderers permanecem bordas substituíveis.

## Compatibilidade

A mudança preserva captura, VAD, barreira de eco, STT e roteamento canônico já
existentes. Ela adiciona guardas ao caminho de narração local e Gemini Live;
não instala OpenJarvis nem cria outro agente, memória ou orquestrador.

## Validação mínima

- compromisso determinístico de frases;
- descarte de reprodução de época antiga;
- barge-in sem cancelamento do trabalho;
- resultado de turno antigo não falado;
- recibos de preparação, compromisso, primeiro áudio e interrupção.
