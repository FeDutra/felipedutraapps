# PULSO v1.0: Definição Canónica de Campos das Entidades

Este documento consolida a arquitetura de dados final mínima exigida para a operação do Cockpit **PULSO v1.0**, estabelecendo o limite claro entre os dados estritos do barramento e os campos vivos de uso diário. 

Cada propriedade é rigorosamente classificada em uma de 5 categorias:
*   **[Obrigatório]**: Chave crítica para materialização e integridade referencial.
*   **[Opcional]**: Atributo de conveniência operacional geral.
*   **[Estratégico]**: Métrica ou classificação de alto valor para governança e tomadas de decisão.
*   **[Subjetivo]**: Memória não estruturada, impressões finas e anotações livres de contexto.
*   **[Futuro]**: Previsto no *roadmap* para suporte avançado (v1.5 / v2.0 Voz).

---

## 1. Pessoas (`pulso_people`)

As pessoas formam os nós vitais de relacionamento, contexto e oportunidade do ecossistema.

### Bloco 1: Dados Básicos
*   `id` **[Obrigatório]**: Identificador único canônico no formato `person_<slug>`.
*   `slug` **[Obrigatório]**: String normalizada para indexação.
*   `name` **[Obrigatório]**: Nome completo ou apelido reconhecível.
*   `status` **[Obrigatório]**: Estado do nó (`active`, `inactive`, `archived`).
*   `role` **[Opcional]**: Cargo ou papel principal.
*   `organization` **[Opcional]**: Empresa ou instituição vinculada.

### Bloco 2: Contato
*   `contactMethods` **[Opcional]**: Objeto ou mapa de contatos.
    *   `email` **[Opcional]**
    *   `phone` **[Opcional]**
    *   `whatsapp` **[Opcional]**: Principal canal de interface Lótus.
    *   `linkedin` / `instagram` **[Opcional]**
*   `location` **[Opcional]**: Estrutura contendo `city` e `country`.

### Bloco 3: Relação
*   `relationshipToFe` (ou `relationType`) **[Obrigatório]**: Natureza do laço (ex: `partner`, `provider`, `team`, `friend`, `family`).
*   `importance` (ou `attentionLevel`) **[Obrigatório]**: Nivel de prioridade de gestão (`critical`, `high`, `medium`, `low`).
*   `relationshipLevel` **[Estratégico]**: Profundidade histórica do relacionamento.
*   `trustLevel` **[Estratégico]**: Índice de confiança estabelecida.

### Bloco 4: Projetos Vinculados
*   `areaRef` **[Opcional]**: Referência à Área mãe.
*   `projectRef` (ou `projectRefs`) **[Opcional]**: Escopo de execução ativa vinculada.

### Bloco 5: Histórico
*   `lastInteractionSummary` **[Estratégico]**: Síntese do último ponto de contato.
*   `relationshipHistory` **[Subjetivo]**: Trilha de eventos marcantes e memórias consolidadas.
*   `createdAt` / `updatedAt` **[Obrigatório]**: Carimbos de tempo geridos pelo sistema.

### Bloco 6: Potencial
*   `networkValue` **[Estratégico]**: Relevância e conectividade do stakeholder na rede.
*   `commercialPotential` / `partnershipPotential` / `creativePotential` **[Estratégico]**: Matrizes de oportunidade de expansão.
*   `riskLevel` **[Estratégico]**: Avaliação de risco ou fricção associada.

### Bloco 7: Acompanhamento
*   `lastContactAt` **[Opcional]**: Data do último carimbo de comunicação real.
*   `nextContactAt` **[Estratégico]**: Alarme para recorrência de aproximação.
*   `followUpCadence` / `followUpReason` **[Estratégico]**: Gatilhos automatizados para a Lótus sugerir contato.
*   `openLoops` / `pendingPromises` **[Estratégico]**: Pontas soltas e acordos firmados aguardando fechamento.

### Bloco 8: Notas Subjetivas
*   `notes` **[Subjetivo]**: Observações diretas do agente de campo.
*   `personalContext` **[Subjetivo]**: Interesses, habilidades conhecidas, tópicos sensíveis e estilo preferido de comunicação.

---

## 2. Fontes (`pulso_sources`)
*   `id` / `slug` / `name` **[Obrigatório]**
*   `type` **[Obrigatório]**: Conector base (ex: `google_sheets`, `notion`, `obsidian`).
*   `system` **[Obrigatório]**: Sistema externo de ancoragem.
*   `status` **[Obrigatório]**
*   `relevance` (ou `priority`) **[Obrigatório]**: Importância na composição de contexto.
*   `syncMode` **[Obrigatório]**: `manual`, `auto`.
*   `url` **[Opcional]**: Endereço de acesso direto.
*   `accessNotes` **[Subjetivo]**: Observações sobre permissões ou localização de chaves.
*   `lastSyncAt` **[Opcional]**
*   `nextSyncAt` / `syncStatus` **[Futuro]**: Monitoramento nativo de integridade de ingestão.

---

## 3. Projetos (`pulso_projects`)
*   `id` / `slug` / `name` **[Obrigatório]**
*   `status` **[Obrigatório]**: `new`, `active`, `paused`, `archived`, `completed`.
*   `stage` **[Obrigatório]**: `captura`, `planejamento`, `execução`, `manutenção`.
*   `priority` **[Obrigatório]**
*   `objective` **[Opcional]**: Missão clara da frente.
*   `areaRef` **[Obrigatório]**: Projeto sempre nasce ancorado em uma Área estrutural.
*   `nextStep` **[Estratégico]**: Ação de desobstrução imediata.
*   `riskSummary` **[Estratégico]**: Riscos iminentes mapeados.
*   `whyItMatters` / `successCriteria` **[Estratégico]**: Critérios canônicos de sucesso.
*   `deadline` / `startedAt` / `completedAt` **[Opcional]**
*   `budget` / `businessImpact` **[Futuro]**: Atributos estendidos para relatórios executivos.

---

## 4. Tarefas (`pulso_tasks`)
*   `id` / `slug` / `title` (ou `name`) **[Obrigatório]**
*   `status` **[Obrigatório]**: `new`, `in_progress`, `completed`.
*   `priority` **[Obrigatório]**
*   `ownerRefs` **[Obrigatório]**: Array estrito contendo os responsáveis pela entrega.
*   `areaRef` / `projectRef` **[Opcional]**
*   `description` (ou `notes`) **[Opcional]**
*   `dueDate` / `dueAt` **[Opcional]**
*   `completedAt` **[Opcional]**
*   `blockedBy` / `blockReason` **[Estratégico]**: Identificação atômica de bloqueios operacionais.
*   `originTrail` **[Estratégico]**: Metadados de rastreabilidade contendo `requestId` e `channel` de origem.

---

## 5. Decisões (`pulso_decisions`)
*   `id` / `slug` / `title` (ou `name`) **[Obrigatório]**
*   `decision` **[Obrigatório]**: O veredito canônico aprovado.
*   `context` **[Opcional]**: Cenário que motivou o corte.
*   `takenByRefs` **[Obrigatório]**: Stakeholders que assumiram a decisão.
*   `impactSummary` **[Estratégico]**: Consequências e desdobramentos mapeados.
*   `alternativesConsidered` **[Subjetivo]**: Histórico de opções descartadas.

---

## 6. Alertas (`pulso_alerts`)
*   `id` / `slug` / `title` (ou `name`) **[Obrigatório]**
*   `severity` **[Obrigatório]**: `critical`, `high`, `medium`, `low`.
*   `status` **[Obrigatório]**: `active`, `acknowledged`, `resolved`.
*   `description` **[Opcional]**
*   `recommendedAction` **[Estratégico]**: Caminho sugerido para mitigação imediata.
*   `resolvedAt` **[Opcional]**
*   `triggerType` / `riskIfIgnored` **[Futuro]**

---

## 7. Áreas (`pulso_areas`)
*   `id` / `slug` / `name` **[Obrigatório]**
*   `type` **[Obrigatório]**: `business`, `personal`, `infrastructure`, etc.
*   `importance` (ou `priority`) **[Obrigatório]**
*   `status` **[Obrigatório]**
*   `ownerRef` **[Estratégico]**: Guardião canônico da Área.
*   `governancePolicy` **[Estratégico]**: Mapa de regras definindo se novos projetos exigem aprovação compulsoria.

---

## 8. Agentes (`pulso_agents`)
*   `id` / `slug` / `name` / `role` **[Obrigatório]**
*   `status` **[Obrigatório]**
*   `autonomyLevel` **[Obrigatório]**: Limite estrito de permissões de mutação autônoma.
*   `requiresApproval` **[Obrigatório]**: Flag de barreira de governança humana.
*   `inputTypes` / `outputTypes` / `limitations` **[Opcional]**
*   `systemsUsed` **[Opcional]**
*   `lastActivityAt` **[Opcional]**
*   `approvalPolicy` / `knownRisks` **[Estratégico]**

---

## 9. Rotinas (`pulso_routines`)
*   `id` / `name` / `frequency` / `triggerType` / `tool` **[Obrigatório]**
*   `status` **[Obrigatório]**: `success`, `failure`, `broken`.
*   `description` **[Opcional]**
*   `lastRunAt` / `nextRunAt` **[Opcional]**
*   `outputExpected` **[Estratégico]**
*   `schedule` / `outputDestination` **[Futuro]**

---

## 10. Solicitações (`pulso_requests` - Ponte)
*   `id` / `requestType` / `status` / `title` **[Obrigatório]**
*   `priority` **[Obrigatório]**
*   `requestedBy` / `requestedAt` / `updatedAt` **[Obrigatório]**
*   `summary` **[Opcional]**
*   `payload` **[Obrigatório]**: Objeto nativo injetado pela Lótus/OpenClaw.
*   `dedupeKey` **[Obrigatório]**: Chave canônica de garantia de **Idempotência**.
*   `origin` **[Opcional]**: Mapa contendo `channel` (`whatsapp`, `voice`, `web`) e `source`.
*   `result` **[Obrigatório]**: Retorno da execução contendo `action`, `entityRef`, `entityPath` ou arrays de `missingFields` e `question` para injeção de governança.
