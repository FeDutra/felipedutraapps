# SKILL: pulso

## Identidade
- **Nome**: pulso
- **Versão**: 1.0.0
- **Produto**: OpenClaw
- **Agente**: Lótus
- **Status**: active

## Objetivo
Habilitar a comunicação estruturada e segura entre o OpenClaw/Lótus e o sistema PULSO.

Permite que a Lótus emita eventos padronizados (v1) para o endpoint de ingestão do PULSO,
com autenticação, fila local, retry automático e deduplicação por event_id/dedupe_key.

## Fluxo Principal
```
OpenClaw / Lótus  →  pulso_emit.sh  →  POST /api/pulso/ingest  →  PULSO Firestore
```

## Comandos Disponíveis
| Script                   | Descrição                                          |
|--------------------------|----------------------------------------------------|
| `pulso_emit.sh`          | Monta e envia um evento para o PULSO               |
| `pulso_queue_add.sh`     | Adiciona evento na fila local (sem enviar agora)   |
| `pulso_queue_retry.sh`   | Tenta reenviar eventos pendentes/falhos            |
| `pulso_mark_result.sh`   | Registra resultado de um envio (sent/failed)       |
| `pulso_health.sh`        | Exibe resumo de status da fila e conectividade     |

## Segurança
- O token PULSO_INGEST_TOKEN NUNCA deve aparecer em logs, arquivos versionados ou mensagens.
- Ver `config.example.json` para estrutura de configuração.
- Ver `README.md` seção de segurança para instruções de setup.

## Estado Local
- `state/queue.ndjson`  — eventos pendentes de envio
- `state/sent.ndjson`   — eventos enviados com sucesso
- `state/failed.ndjson` — eventos que esgotaram as tentativas de retry

## Contrato
O payload v1 é definido em: `docs/contexto/pulso-openclaw-contract.md`
Endpoint: `https://felipedutraapps.web.app/api/pulso/ingest`
