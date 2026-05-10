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

## 🏗️ Stage 7: Conectividade Real OpenClaw/Lótus (CORRIGIDO)

### Objetivo
Criar a primeira porta de entrada segura e programática para que a Lótus injete inteligência no PULSO.

### Entregas Técnicas
- **Correção Crítica**: Endpoint migrado de Next.js API Route para **Firebase Cloud Function** (`pulsoIngest`) para garantir funcionamento estável no Hosting.
- [x] **Stage 7: Endpoint Seguro de Ingestão (OpenClaw/Lótus)**
- [x] Migração de API Route (Next.js) para Firebase Cloud Function v2 (`pulsoIngest`).
- [x] Proteção via Bearer Token usando Firebase Secret Manager (`PULSO_INGEST_TOKEN`).
- [x] Deduplicação funcional por `event_id` e `dedupe_key`.
- [x] Roteamento automático de eventos OpenClaw para Firestore (`ingestion_events` e `pulso_events`).
- [x] Estabilização da UI com safeguards para dados legados/malformados.
- [x] Validação em produção via `curl` e logs de auditoria.

---

## 🛤️ Roadmap Futuro

### Stage 8: Fontes Externas (Real)
- Conectores com Google Sheets, Drive, Notion e Obsidian.
- Monitoramento de Sync Jobs reais no Health Center.

---
**Registro de Checkpoint de Produção v0.3** (Correção Ingestão via Cloud Functions)
