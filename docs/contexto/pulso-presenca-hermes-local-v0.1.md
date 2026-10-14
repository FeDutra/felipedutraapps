---
title: PULSO · Presença e Hermes local v0.1
status: contrato para canária no iMac
date: 2026-10-14
---

# PULSO · Presença e Hermes local v0.1

## Princípio

Hermes é operador subordinado da Lótus, nunca uma segunda personalidade, fonte
de verdade ou canal independente. PULSO recebe e entrega; Lótus decide; Hermes
executa no Mac quando a capacidade local for mais rápida ou necessária.

## Estado auditado do iMac

- iMac18,3 Intel, macOS 14.8.2, 40 GB RAM.
- Hermes Agent `v0.21.6`, distribuição
  `/Users/fe/.local/share/hermes-agent-pulso-local`.
- Apenas o perfil `default`; nenhum modelo selecionado.
- Gateway e servidor Hermes parados; nenhum canal configurado.
- `cua-driver` não instalado.
- Ollama local contém `qwen3-hermes-64k:latest` 4B Q4, com ferramentas e
  contexto amplo, além de `qwen3:4b` e `qwen3:8b`.
- PULSO e Kokoro local estão ativos; esta auditoria não alterou processos,
  perfis, modelo, permissões ou serviços.

## Fronteira de execução

### Livre em segundo plano

- leitura de agenda, e-mail e WhatsApp;
- busca de arquivos e metadados;
- consulta web simples;
- leitura de estado de aplicativos e processos;
- transformação local sem sobrescrita;
- preparação de uma ação que ainda aguardará aprovação.

Essas operações não abrem aplicativo, não mudam Space, não tomam foco, não
movem cursor e não exibem terminal.

### Só por pedido explícito

- abrir ou focalizar aplicativo;
- abrir URL ou arquivo na interface;
- iniciar reprodução de mídia;
- mostrar resultado visual na MESA ou em outro aplicativo.

### Confirmação humana obrigatória

- enviar mensagem ou e-mail;
- criar, editar ou apagar compromisso;
- excluir, sobrescrever ou mover matéria relevante;
- instalar, atualizar ou alterar sistema;
- credenciais, publicação, dinheiro e relações sensíveis;
- qualquer automação visual que disputará mouse, teclado, foco ou Space.

## Contrato de turno

Toda missão local recebe:

```json
{
  "voiceTurnId": "voice_<timestamp>_<sequence>",
  "requestId": "req_<id>",
  "capability": "whatsapp.read | calendar.read | mail.read | files.search | web.search | app.open",
  "risk": "read_only | visible | confirm_required",
  "payload": {},
  "deadlineMs": 8000
}
```

Hermes devolve eventos correlacionados:

- `accepted` — execução local assumida;
- `progress` — apenas mudança material de fase;
- `approval_required` — ação preparada, sem executar;
- `result` — resultado verificável;
- `unavailable` — capacidade ausente; PULSO pode degradar para OpenClaw/VPS;
- `error` — falha explícita, sem fallback invisível.

Um novo `voiceTurnId` invalida a narração do anterior. O trabalho antigo pode
terminar e aparecer no chat, mas não invade a fala corrente.

## Roteamento da Presença

1. PULSO transcreve e classifica o pedido.
2. Reflexo determinístico local é tentado primeiro quando a intenção e o risco
   forem inequívocos.
3. Consulta local leve vai ao Hermes isolado.
4. Ambiguidade, cruzamento de fontes, contexto pessoal ou trabalho profundo vai
   à Lótus/OpenClaw.
5. A Orbe recebe apenas confirmação, checkpoint útil e resultado curto.
6. A resposta integral continua no chat e abre MESA quando necessário.

## Perfil proposto para a canária

- Perfil isolado: `pulso`.
- Modelo local: `qwen3-hermes-64k:latest` via Ollama.
- Bind: somente `127.0.0.1`.
- Sem gateway de mensageria, cron, navegador, canais, memória autônoma, curadoria
  de skills ou conexão externa própria.
- Sem CUA na primeira canária.
- Ferramentas explícitas e mínimas; shell arbitrário não é API do aplicativo.
- Ciclo de vida pertencente ao app ou a serviço local dedicado, nunca público.

## Gate para ativação

Antes de criar perfil, selecionar modelo ou iniciar servidor local:

1. confirmar a mudança com Fe;
2. registrar backup do estado Hermes e reversão seletiva;
3. provar uma consulta somente leitura sem abrir janela;
4. medir latência, CPU, memória e qualidade;
5. provar cancelamento e correlação por turno;
6. encerrar a canária sem deixar serviço ou processo órfão.

