# PULSO v1.0: Definição Canônica de Campos e Usabilidade por Entidade

A decisão mestre de produto que rege a arquitetura do **PULSO v1.0** dita que:

> [!IMPORTANT]
> **A versão v1.0 precisa ser operável antes de ser completa.**

Para evitar o inchaço da plataforma e garantir uma interface ágil e limpa, os atributos de todas as entidades são estruturados sob a **Matriz de 5 Camadas de Produto**:
1.  **[Obrigatório]**: O núcleo mínimo vital. Sem essas chaves, o registro não nasce como entidade madura no banco (bloqueia a criação ou mantém-se como rascunho de triagem).
2.  **[Opcional]**: Atributos de conveniência que enriquecem o uso, mas cuja ausência jamais trava o fluxo de ingestão.
3.  **[Estratégico]**: Indicadores mestre de gestão, priorização, risco, alavancagem de rede e cadência de operação.
4.  **[Subjetivo]**: Memória humana fina, notas livres, sínteses abertas e contexto relacional não estruturado.
5.  **[Futuro]**: Previstos para iterações avançadas. Não devem ser cobrados como exigência de barramento ou validação na v1.0.

---

## 1. Pessoas (`pulso_people`)

O nó mais sensível de capital social. Uma Pessoa pode nascer como **rascunho** a partir de uma menção em áudio com dados esparsos, mas só é promovida ao status de **entidade madura** se detiver o conjunto obrigatório mínimo.

### Camadas de Atributos

#### 🔴 Obrigatório (Mínimo de Maturidade)
*   `id`: Identificador único no formato `person_<hash>`.
*   `name`: Nome limpo ou designação inequívoca.
*   `status`: Estado de vida (`active`, `inactive`, `archived`).
*   `relationType`: Categoria do vínculo (`partner`, `client`, `team`, `friend`, `provider`, `mentor`).
*   `importance`: Peso na gestão de atenção (`critical`, `high`, `medium`, `low`).
*   `createdAt` e `updatedAt`: Carimbos temporais do sistema.
*   *Nota*: Exige-se também a presença de pelo menos um canal de contato ou origem clara da menção.

#### 🟡 Opcional (Enriquecimento de Contato)
*   `whatsapp`: Chave primária de mensageria da Lótus.
*   `email` / `phone`: Vias de comunicação direta.
*   `profession` / `organization`: Contexto funcional corporativo.
*   `areaRef` / `projectRefs`: Vínculos com o esqueleto operacional.

#### 🔵 Estratégico (Alavancagem e Recorrência)
*   `relationshipLevel` e `trustLevel`: Índices de profundidade e confiança mútua.
*   `commercialPotential` / `partnershipPotential`: Matrizes de alavancagem para novos negócios ou co-criações.
*   `networkValue`: Conectividade e peso do *stakeholder* na rede.
*   `lastContactAt`: Data do último toque real bem-sucedido.
*   `nextContactAt`: Alarme disparador de sugestão de *follow-up*.
*   `followUpReason`: O gatilho ou justificativa para reatar o contato.
*   `openLoops` / `pendingPromises`: Acordos firmados ou pontas soltas exigindo fechamento.

#### 🟣 Subjetivo (Memória Relacional)
*   `notes` / `personalContext`: Peculiaridades, preferências e restrições de vida.
*   `relationshipHistory`: Trilha narrativa dos marcos da relação.
*   `lastInteractionSummary`: Síntese textual do último encontro ou conversa.
*   `knownSkills`: Competências raras mapeadas.
*   `communicationStyle`: Estilo preferido de abordagem.

#### ⚪ Futuro (Não Bloqueante)
*   `creativePotential`, `influenceLevel`, `riskLevel`, `importantDates`, `followUpCadence`.

---

## 2. Fontes (`pulso_sources`)

Sensores de memória externa e sincronização.
*   **Obrigatório**: `id`, `name`, `type`, `system`, `status`, `relevance`, `syncMode`.
*   **Progressivo/Opcional**: `url`, `lastSyncAt`, `accessNotes`, vínculos com projetos.

---

## 3. Projetos (`pulso_projects`)

Frentes de intenção com prazos e entregáveis.
*   **Obrigatório**: `id`, `name`, `status`, `stage`, `priority`, `areaRef`.
*   **Regra de Produto**: Um projeto sem `nextStep` tem permissão estrutural para existir, mas a interface deve aplicar uma marcação visual contundente e elegante de **"Sem próximo passo"** no *card* para alertar sobre o gargalo de desobstrução.
*   **Estratégico/Importante**: `objective`, `nextStep`, `riskSummary`, `whyItMatters`, `successCriteria`, `deadline`.

---

## 4. Tarefas (`pulso_tasks`)

Unidades atômicas de esforço.
*   **Obrigatório**: `id`, `title`, `status`, `priority`, `ownerRefs`, `createdAt`, `updatedAt`.
*   **Regra de Delegação**: Se a tarefa chega via ingestão da Bridge sem um dono humano claro, ela nasce em estado de triagem sob a responsabilidade genérica da Lótus/Fê, mas deve ser explicitamente sinalizada na UI como **pendente de atribuição**.
*   **Estratégico/Importante**: `description`, `areaRef`, `projectRef`, `dueDate`, `completedAt`, `blockedBy`, `blockReason`, `nextAction`, `originTrail`, `notes`.

---

## 5. Decisões (`pulso_decisions`)

A âncora de sabedoria e alinhamento mestre.
*   **Obrigatório**: `id`, `title`, `decision`, `takenByRefs`, `createdAt`.
*   **Regra de Barreira**: Se o *payload* da IA tenta registrar uma decisão sem preencher a string literal do veredito em `decision`, o processador ejeta a transação automaticamente para a quarentena de `needs_clarification`.

---

## 6. Alertas (`pulso_alerts`)

Sinais de risco e contenção de danos.
*   **Obrigatório**: `id`, `title`, `severity`, `status`, `createdAt`.
*   **Regra de Risco**: Se um alerta for classificado como `critical` e o agente omitir o caminho de mitigação em `recommendedAction`, a transação é retida em `needs_clarification`.
*   **Métrica de Qualidade**: Um alerta excelente na v1.0 responde de forma cabal a 4 vetores: *O que é*, *Quão grave é*, *Está ativo ou resolvido*, e *O que fazer*.

---

## 7. Áreas (`pulso_areas`)

O telhado estrutural e as vigas de fundação.
*   **Obrigatório**: `id`, `name`, `type`, `priority`, `status`.
*   **Governança**: A injeção de novas Áreas estruturais exige compulsoriamente a passagem pela barreira de `needs_approval`.

---

## 8. Agentes (`pulso_agents`)

Identidades virtuais e *skills* com autonomia mestre.
*   **Obrigatório**: `id`, `name`, `role`, `status`, `autonomyLevel`, `requiresApproval`.
*   **Governança Estrita**: Agentes ativos **nunca** nascem de forma automatizada sem *approval*.
*   **Mapeamento Importante**: `systemsUsed`, `limitations`, `inputTypes`, `outputTypes`, `approvalPolicy`, `knownRisks`, `lastActivityAt`.

---

## 9. Rotinas (`pulso_routines`)

Loops periódicos. Na v1.0 operam sob o escopo de leitura e monitoramento visual de integridade.
*   **Obrigatório**: `id`, `name`, `frequency`, `triggerType`, `tool`, `status`.
*   **Importante**: `description`, `lastRunAt`, `nextRunAt`, `outputExpected`, `notes`.

---

## Política Operacional Mestre v1.0

### ✅ Autonomia de Criação Direta (Lótus ➔ `completed`)
A IA cria autonomamente: Pessoas, Fontes, Tarefas, Decisões, Alertas, e Projetos contidos dentro de uma Área preexistente.

### 🔄 Autonomia de Atualização Direta
A IA atualiza autonomamente: Atributos de Pessoas e Fontes, progresso de Tarefas e Projetos, *status* de Projetos, prioridades, notas de campo, e vínculos simples de Pessoas/Fontes com Projetos.

### 📦 Autonomia de Arquivamento Direto
A IA arquiva autonomamente: Documentos gerados com finalidade de teste, tarefas finalizadas ou canceladas, e projetos autorizados.

### 🛑 Exigência de Aprovação Humana (`needs_approval`)
Dispara notificação de chancela perante: Criação ou arquivamento de Áreas, criação, ativação ou aumento de autonomia de Agentes, e ações que envolvam deleções lógicas em massa.

### ❓ Exigência de Clarificação (`needs_clarification`)
Retém a transação e solicita insumos se: Faltar nome/título, faltar referência canônica obrigatória, o vínculo for ambíguo, a tarefa nascer órfã contra a regra de negócio, ou houver risco de sobreposição destrutiva.

### ❌ Interdições Absolutas (O que NUNCA Fazer)
*   Deletar fisicamente documentos do banco de produção (`DELETE`).
*   Emitir pacotes na Bridge para cadastros triviais sem valor de alteração de estado.
*   Criar ou ativar Agentes/Áreas sem autorização expressa.
*   Aplicar *workarounds* silenciosos na extração de *schemas*.
