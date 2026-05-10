# Status Técnico: Projeto PULSO

## 🚀 Versão Atual: PULSO v0.1 Produção
**Estado**: Online, autenticado, persistent e funcional.

- **Data do Deploy**: 2026-05-08
- **Domínio Publicado**: [https://felipedutraapps.web.app](https://felipedutraapps.web.app)
- **Projeto Firebase**: `felipedutraapps`
- **Commit em Produção**: `cca6e9d`

### 🛣️ Rotas Online
- `/pulso`: Dashboard principal (Cockpit estratégico).
- `/pulso/inbox`: Central de captura, triagem e persistência.
- `/pulso/ecossistema`: Visualização orgânica de Áreas, Projetos, Fontes e Pessoas.
- `/pulso/health`: Monitoramento de integridade sistêmica e técnica.
- `/pulso/metabolismo`: Gestão de agentes (Lótus/Watchdog) e rotinas (Crons).
- `/pulso/eventos`: Barramento de auditoria e sincronização (Outbox).

---

## 🛠️ Infraestrutura & Segurança
- **Hospedagem**: Firebase Hosting.
- **Autenticação**: Firebase Auth (Google Provider) via `AuthGate`.
- **Banco de Dados**: Google Firestore (Modo Real).
- **Security Rules**: Acesso restrito (`request.auth != null`).
- **Data Mode**: `firestore` (configurado via `.env.local`).
- **Workspace ID**: `felipe_dutra`.

### Status dos Módulos
- **Auth**: ✅ Funcionando (Gate de segurança ativo).
- **Firestore**: ✅ Inicializado e sincronizado.
- **Rules**: ✅ Seguras e deployadas.
- **Inbox**: ✅ Criando, editando e persistindo registros reais.
- **Dashboard**: ✅ Lendo métricas reais do Firestore.
- **Ecossistema**: ✅ Lendo estruturas reais (Áreas/Projetos).
- **Health/Metabolismo**: ✅ Monitoramento de integridade e agentes ativos (Stage 5).
- **Eventos/Outbox**: ✅ Protocolo de comunicação bidirecional pronto (Stage 6).

---

## 📋 Checklist de Uso Real (Validação Contínua)
Para os próximos dias de operação:
- [ ] Criar registros reais no Inbox (captura instantânea).
- [ ] Editar registros (validar se mudanças no título/descrição persistem).
- [ ] Triar itens (mudar status para `triaged`).
- [ ] Converter itens em Notas ou Tarefas (validar status `converted`).
- [ ] Revisar Áreas e Projetos no Ecossistema.
- [ ] Testar navegação em desktop (foco em UX/Performance).
- [ ] Observar possíveis bugs de interface ou lentidão em rede.

---

## 📅 Próximo Passo Recomendado
- **Stage 5: Expansão de Features**: Iniciar a integração de Fontes Externas (Google Sheets/Drive) ou a primeira camada de Automação.

---

---

## 🏗️ Stage 6: Protocolo de Ingestão + Eventos + Outbox (CONCLUÍDO)

### Objetivo
Criar a infraestrutura para que o PULSO receba, registre e exponha eventos de forma organizada, preparando a integração bidirecional com a Lótus no OpenClaw.

### Coleções Ativas
- `pulso_ingestion_events`: Registros brutos de entrada externa com suporte a deduplicação.
- `pulso_events`: Log oficial de mudanças de estado (Outbox).

### Fluxos Instrumentados
- **Inbox**: Criação, edição, triagem e conversão geram eventos automáticos.
- **Health**: Reconhecimento e resolução de alertas geram eventos.
- **Metabolismo**: Pausa e reativação de rotinas geram eventos.
- **Ecossistema**: Criação de projetos e atualização de fontes agora geram eventos.

### Contrato OpenClaw
- Documentado em `pulso-openclaw-contract.md`.
- Suporte a idempotência via `event_id` e `dedupe_key`.

---

## 🛤️ Roadmap Futuro

## 🏗️ Stage 7: Endpoint Seguro de Ingestão OpenClaw/Lótus ✅ CONCLUÍDO

### Objetivo
Criar a primeira porta de entrada segura e programática para que a Lótus (OpenClaw) injete dados estruturados no PULSO.

### Entregas Técnicas
- [x] Endpoint migrado de Next.js API Route → **Firebase Cloud Function v2** (`pulsoIngest`).
- [x] Rewrite no `firebase.json`: `/api/pulso/ingest` → `pulsoIngest`.
- [x] Autenticação via **Bearer Token** com Firebase Secret Manager (`PULSO_INGEST_TOKEN` v2).
- [x] Deduplicação idempotente por `event_id` e `dedupe_key` no Firestore (Admin SDK).
- [x] Roteamento para `pulso_ingestion_events` e `pulso_events` com schema correto.
- [x] Estabilização da UI `/pulso/eventos` com null-guards para dados legados.
- [x] Skill PULSO v1 criada em `skills/pulso/` e commitada.

### Endpoint de Produção
```
POST https://felipedutraapps.web.app/api/pulso/ingest
Authorization: Bearer $PULSO_INGEST_TOKEN
Content-Type: application/json
```

### Validação em Produção (2026-05-10)

| Teste | Cenário | Esperado | HTTP | Resultado |
|-------|---------|----------|------|-----------|
| A | Sem token | 401 | `401` | ✅ |
| B | Token inválido | 401 | `401` | ✅ |
| C | `agent_update` válido | 201 | `201 {"status":"success"}` | ✅ |
| D | Reenvio mesmo `event_id` | duplicate | `200 {"status":"duplicate"}` | ✅ |
| E | `task` válida | 201 | `201 {"status":"success"}` | ✅ |
| F | `alert` para Health Center | 201 | `201 {"status":"success"}` | ✅ |

### Skill PULSO v1 — `skills/pulso/`
- `pulso_emit.sh` — monta e envia eventos v1 com autenticação segura
- `pulso_queue_add.sh` — fila local NDJSON para envio diferido
- `pulso_queue_retry.sh` — retry com backoff (0s/30s/2min/10min/30min)
- `pulso_mark_result.sh` — registra sent/failed por event_id
- `pulso_health.sh` — dashboard de status + teste de conectividade
- Templates: `agent_update.json`, `task.json`, `alert.json`
- Token: carregado de `$PULSO_INGEST_TOKEN` ou `/root/.openclaw/secrets/pulso.env` (600)
- Estado local: `state/queue.ndjson`, `sent.ndjson`, `failed.ndjson` (fora do Git)

### Stage 7.2: Política de emissão OpenClaw → PULSO v0.1 ✅ CONCLUÍDO

#### Objetivo
Formalizar as regras de quando e como os agentes operacionais devem emitir sinais para o PULSO, priorizando a mudança de estado sobre a atividade técnica.

- **Política Criada no OpenClaw**: `/root/.openclaw/workspace/skills/pulso/policy.md`
- **Política Espelhada no PULSO**: `docs/contexto/pulso-openclaw-emission-policy.md`
- **Tipos Ativos v0.1**: `task`, `decision`, `alert`, `project_update`.
- **Tipos em Espera**: `note`, `agent_update` automático, `health_signal` detalhado, `lateralidade`, `resumo operacional`, `leitura de fonte`.

#### Princípio Central
O PULSO recebe mudança de estado, não atividade.

#### Próxima Fase
Teste manual controlado de 48h (máximo 5 emissões/dia) para validar a utilidade real dos sinais antes de novas automações.

### Stage 7.4: Binding estrutural Área/Projeto v0.1 ✅ CONCLUÍDO

#### Objetivo
Implementar a ancoragem estrutural de eventos OpenClaw a entidades do ecossistema (Área e Projeto).

- **Endpoint v1**: Atualizado para extrair `area_ref` e `project_ref`.
- **Normalização**: Persistência interna como `areaRef` e `projectRef`.
- **Compatibilidade**: Suporte a snake_case, camelCase e fallbacks (raiz, context, payload).
- **UI**: Exibição de contexto de Área/Projeto no Barramento de Eventos.

---

## 🛤️ Roadmap

### Stage 8: Ativação Real no OpenClaw
- Instalar e configurar a skill no servidor OpenClaw (VPS).
- Emitir primeiro `agent_update` real da Lótus em produção.
- Configurar cron de `pulso_queue_retry.sh` para resiliência.
- Validar aparição de eventos reais em `/pulso/eventos`.

### Stage 9: Fontes Externas
- Conectores com Google Sheets, Drive, Notion e Obsidian.
- Monitoramento de Sync Jobs reais no Health Center.

---
**Registro de Checkpoint de Produção v0.6** — Stage 7.4 concluído, binding estrutural implementado. (2026-05-10)
