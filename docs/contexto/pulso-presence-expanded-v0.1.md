# PULSO · Presença ampliada v0.1

## Contrato

Cada fala é classificada de novo, sem herdar a velocidade do turno anterior:

1. **reflexo local** — abrir aplicativo e tocar música;
2. **consulta rápida** — agenda por intervalo e últimas mensagens do WhatsApp;
3. **trabalho profundo** — Lótus/OpenClaw, com resultado completo no chat/MESA.

## Fronteiras

- Apple Music roda por comando Tauri tipado; texto do usuário nunca vira shell.
- WhatsApp usa `wacli` em modo `--read-only`, sem abrir interface, limitado a
  cinco mensagens e quatro segundos por consulta.
- Agenda aceita intervalo inclusivo de até 31 dias e consulta as duas contas
  Google já configuradas.
- Trabalho profundo dispara um pulso local discreto, que pausa durante fala e
  termina no resultado. Até três checkpoints semânticos podem ser narrados.
- Resultado profundo pode abrir a MESA; interagir ou fechar a MESA não encerra
  a sessão de Presença.
- Mensagens e resultados continuam pesquisáveis no chat canônico.

## Critérios desta candidata

- `hoje até quarta-feira` permanece em consulta rápida;
- `última mensagem do Rodrigo` não toma mouse nem tela;
- `toca Bon Iver no Apple Music` é reflexo local mesmo após turno profundo;
- nenhum pulso ou checkpoint sobrepõe a voz;
- resultado velho não invade turno novo;
- gravação comum permanece intacta.
