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
- [x] Cloud Function `pulsoIngest` extrai e normaliza `areaRef`/`projectRef`.
- [x] UI de Eventos exibe chips de contexto e drawer de metadados.
- [x] Contrato v1 atualizado com suporte a binding estrutural.

### [Stage 7.5] Correção de Sincronia e Visibilidade (Audit-Fix)
- [x] Auditoria ponta a ponta: Identificada divergência de ambiente (Modo Mock no Frontend).
- [x] Forçado `NEXT_PUBLIC_PULSO_DATA_MODE=firestore` via `.env.production`.
- [x] Expansão do repositório para suportar consultas por Área e Projeto.
- [x] Implementação de "Sinais do Barramento" no `EntityDetailDrawer` do Ecossistema.

---

## 🏗️ Stage 7.6: Requests Bridge validada ✅ CONCLUÍDO

### Objetivo
Estabelecer a ponte assíncrona para que a Lótus (OpenClaw) consuma solicitações operacionais do PULSO de forma segura.

### Validações Realizadas
- [x] **refresh_state**: Ciclo completo `pending` → `claim` → `complete` validado via bridge.
- [x] **create_agent**: Ciclo `pending` → `claim` → `needs_clarification` validado.
- [x] **Segurança**: Endpoint `/pulsoRequests` protegido por token Bearer e Secret Manager.
- [x] **Integridade**: Lock atômico via transações no Firestore para evitar double-claim.
- [x] **OpenClaw Integration**: Confirmado que agentes externos não emitem eventos indevidos e não executam ações sem autorização.

### Próxima Fase
- Entrada operacional real para `register_source`, `register_person` e `create_task` via Requests Layer.
- Implementação de filtros de autonomia e aprovação na interface.

---

> **Checkpoint Produção (PULSO v0.8)**
> Data: 2026-05-11
> Status: Requests Bridge Operacional.

---

## 🏗️ Stage 7.8: Request Authoring Bridge v0.1 + Materialização Automática ✅ CONCLUÍDO

### Objetivo
Fechar o ciclo operacional ponta a ponta permitindo que a OpenClaw/Lótus crie solicitações de forma autônoma a partir de ordens capturadas fora da UI (ex: WhatsApp) e, após o processamento, garanta a materialização automática na base canônica do ecossistema.

### Entregas Técnicas
- [x] **Endpoint de Criação**: Criada a rota `POST /create` na Cloud Function `pulsoRequests` (via rewrite `/api/pulso/requests/create`).
- [x] **Idempotência Operacional**: Suporte nativo à chave `dedupeKey` para impedir duplicidades decorrentes de duplos disparos de mensageria.
- [x] **Rastreabilidade de Autoria**: Incorporação do objeto `origin` (`channel`, `source`, `messageRef`) distinguindo interações de usuários humanos vs. agentes na interface de triagem.
- [x] **Dispatcher de Materialização**: Implementada a conversão estrutural de intenções concluídas (`complete`) em entidades do ecossistema para todos os escopos suportados:
  - `register_person` → materializa em `pulso_people`.
  - `register_source` → materializa em `pulso_sources`.
  - `create_task` → materializa em `pulso_tasks` com vínculo de autoria e prioridade.
  - `register_decision` → materializa em `pulso_decisions`.
  - `create_alert` → materializa em `pulso_alerts`.
  - `create_project` e `create_area` → materialização e vinculação direta.
  - `create_agent` → blindado estruturalmente para retornar `needs_approval`.
- [x] **Persistência de Resultados**: Retorno canônico de `entityRef` e `entityPath` para navegação direta a partir dos cartões de solicitação.

### Status de Validação Externa (Honesto & Transparente)
- **Requests Bridge**: Validada em fluxos básicos e de autoria.
- **Materialização Geral**: Implementada internamente (com Dispatcher, fallbacks e chaves de navegação), mas **pendente de validação e prova externa pela Lótus/OpenClaw**.
- **Kit Operacional Entregue**:
  - `docs/contexto/pulso-requests-bridge.md` — Contrato e especificação canônica.
  - `docs/contexto/pulso-requests-curl-examples.md` — Guia rápido de chamadas cURL.
  - `scripts/pulso/test-materialization-cycle.mjs` — Automação de teste ponta a ponta.
  - `/pulso/debug/requests` — Cockpit visual administrativo para auditar desfechos de materialização e questionamentos na base.
- **Próximo Passo**: A Lótus/OpenClaw consumir o Kit Operacional, certificar as chaves retornadas (`entityRef`/`entityPath`) e atestar a existência real nas coleções canônicas de destino.
