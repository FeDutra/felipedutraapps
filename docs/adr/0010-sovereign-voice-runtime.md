# ADR 0010 · Runtime soberano de voz

## Decisão

A PULSO Core possui o estado canônico de cada turno de voz. STT, modelos e TTS
são adaptadores substituíveis; nenhum deles pode reescrever uma resposta já
autorizada nem possuir o resultado durável de uma ação.

O contrato introduz:

- preparação de resposta com autoridade explícita;
- frases comprometidas, determinísticas e imutáveis;
- épocas de reprodução, para invalidar áudio antigo após barge-in;
- resultado de ação durável, independente da narração;
- telemetria por fase e latência, sem áudio, texto ou transcrição;
- reconstrução integral a partir do event log SQLite.

## Referência

O desenho foi confrontado com os padrões públicos de voz do OpenJarvis. A
PULSO não incorpora nem instala o framework: absorve apenas os princípios que
preservam autoridade canônica, cancelamento e observabilidade.

## Consequências

- Renderers podem pré-aquecer e antecipar síntese, mas não possuem cognição.
- Interromper áudio não cancela nem apaga trabalho já concluído.
- Um callback de uma época antiga é inofensivo.
- Provedores locais ou remotos podem mudar sem alterar o domínio de voz.
