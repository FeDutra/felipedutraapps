# PULSO · máquina explícita de turnos da Presença · v0.1

**Data:** 15/10/2026  
**Baseline:** `a043db43`  
**Estado:** núcleo implementado e integrado; ativação física ainda não realizada.

## Objetivo

Separar identidade e propriedade do turno das camadas de microfone, STT, LLM e
TTS. A máquina não executa trabalho e não produz áudio. Ela decide apenas se um
evento pertence ao turno que ainda pode falar.

## Estados

```text
idle
listening
capturing
closing
transcribing
routing
working
narrating
interrupted
failed
```

## Identidade

Cada fala recebe `turnId` antes de deixar a captura. Quando o pedido canônico é
persistido, a máquina registra `turnId → requestId`. Checkpoint e resultado só
podem ser narrados quando essa relação coincide e o turno ainda possui a
autoridade audível.

## Regras

1. Um novo turno revoga a autoridade audível do anterior, mas não cancela seu
   trabalho em bastidor.
2. Resultado antigo permanece no chat e recebe decisão `chat_only`.
3. Interrupção cancela narração, não o pedido canônico.
4. Um `requestId` não pode pertencer a dois turnos.
5. Fim de narração antigo não altera o estado de um turno novo.
6. Resultado cuja narração já foi reivindicada não fala duas vezes.
7. Sessão encerrada recusa qualquer áudio tardio.

## Integração inicial

- `VoiceSessionController` abre o turno no início real da fala;
- fechamento, transcrição e roteamento avançam a mesma identidade;
- o retorno de `handleSendMessage` liga o `requestId` ao turno;
- a resposta assíncrona do Firestore passa o `requestId` para a narração;
- Gemini Live e o transporte turn-based usam a mesma autoridade de turno;
- transportes, modelos, endpoints e gravação comum permanecem inalterados.

## Testes automatizados

O núcleo possui provas para:

- ciclo completo;
- resultado tardio durante turno novo;
- interrupção com trabalho ainda ativo;
- `requestId` incompatível;
- tentativa de reutilizar `requestId`;
- resultado após encerramento da sessão;
- final de narração antigo;
- duplicidade de resultado falado.

## Limite desta etapa

A interface ainda recebe estados visuais do controlador legado. A máquina já é
autoridade de identidade e narração, mas a migração completa de efeitos de
áudio e estado visual deve ocorrer numa etapa posterior, após a prova física do
recorte atual.
