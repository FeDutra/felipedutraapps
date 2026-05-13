# PULSO v1.0: Matriz de Contratos de RequestTypes (Requests Bridge)

Este documento estabelece o contrato canônico de todos os `requestTypes` autorizados e mapeados na Requests Bridge do ecossistema PULSO, classificando rigorosamente cada intenção nas 4 camadas operacionais:
1. Implementado no backend
2. Operável pela Lótus/OpenClaw via Requests Bridge
3. Visível corretamente na UI
4. Confiável para uso diário

---

> [!IMPORTANT]
> **Certificação Universal de Chaves (Bateria Encadeada OpenClaw)**
> Conforme as leis de tráfego da versão `1.0.0`, todas as intenções encarregadas da manutenção do ciclo de vida das entidades (`update_*` e `archive_*`) exigem estritamente a injeção do **`entityRef` real** gerado no instante do nascimento ou obtido de forma determinística na base viva. **É sumariamente vetado** o tráfego de identificadores presumidos ou *slugs* gerados por regras de cliente.
> 
> *A integridade das rotas de `create`, `update` e `archive` operando com referências reais foi chancelada e homologada com sucesso na malha de testes autônomos para as entidades **Pessoas**, **Fontes**, **Projetos** e **Tarefas**.*

---

## 1. Pessoas (`pulso_people`)

### `register_person`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Criação (Create)
*   **Campos Mínimos Obrigatórios**: `payload.name`
*   **Campos Opcionais**: `role`, `relationType` (ou `relationshipToFe`), `attentionLevel` (ou `importance`), `notes`, `areaRef`, `projectRef`
*   **Exige Approval**: Não
*   **Exige Clarification**: Sim, se `payload.name` estiver ausente.
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_people`
*   **Result Esperado**: `{"matResult": {"ok": true, "action": "created", "entityType": "person", "entityRef": "person_<slug>", "entityPath": "..."}}`
*   **Efeito Esperado na UI**: Novo card/linha renderizado nas listagens de Stakeholders da página Ecossistema e nos drawers de Área/Projeto se houver vínculo.
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)
*   **Observações de Risco**: Baixo. Fallbacks de tipagem cobrem mapeamentos legados de chaves.

### `update_person`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Atualização (Update)
*   **Campos Mínimos Obrigatórios**: `payload.personRef` (ou `name`/`slug` resolvível no payload)
*   **Campos Opcionais**: `patch` contendo chaves autorizadas (`name`, `role`, `relationshipToFe`, `importance`, `status`, `areaRef`, `projectRef`, `notes`)
*   **Exige Approval**: Não
*   **Exige Clarification**: Sim, se a pessoa não for encontrada ou a referência for nula.
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_people`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `archive_person`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Arquivamento lógico (Soft Archive)
*   **Campos Mínimos Obrigatórios**: `payload.personRef` (ou `name`/`slug`)
*   **Campos Opcionais**: `reason`, `notes`
*   **Exige Approval**: Não
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_people`
*   **Efeito Esperado na UI**: Registro filtrado/ocultado das exibições ativas padrão, mantido no histórico de "Arquivados".
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `unarchive_person`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Desarquivamento (Reativar)
*   **Status Atual**: 🔴 **Vermelho** (Não operar ainda - Ausente do *switch* da Cloud Function, embora mapeável no cliente via update genérico).

### `link_person_to_project` / `unlink_person_from_project`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Associação de Escopo
*   **Campos Mínimos Obrigatórios**: `personRef`, `projectRef` (para vínculo)
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `link_person_to_area` / `unlink_person_from_area`
*   **Entidade Afetada**: Pessoas
*   **Operação**: Associação de Domínio
*   **Campos Mínimos Obrigatórios**: `personRef`, `areaRef` (para vínculo)
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

---

## 2. Fontes (`pulso_sources`)

### `register_source`
*   **Entidade Afetada**: Fontes
*   **Operação**: Criação (Create)
*   **Campos Mínimos Obrigatórios**: `payload.name`
*   **Campos Opcionais**: `type`, `system`, `url`, `relevance` (ou `priority`), `notes`, `areaRef`, `projectRef`
*   **Exige Approval**: Não
*   **Exige Clarification**: Sim, sem `name`.
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_sources`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `update_source` / `archive_source`
*   **Entidade Afetada**: Fontes
*   **Operação**: Manutenção e Purga Lógica
*   **Campos Mínimos Obrigatórios**: `sourceRef` (ou `name` resolvível)
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `unarchive_source`
*   **Status Atual**: 🔴 **Vermelho** (Não operar ainda - Ausente da Cloud Function).

### `link_source_to_project` / `unlink_source_from_project` / `link_source_to_area` / `unlink_source_from_area`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

---

## 3. Tarefas (`pulso_tasks`)

### `create_task`
*   **Entidade Afetada**: Tarefas
*   **Operação**: Criação (Create)
*   **Campos Mínimos Obrigatórios**: `payload.title` (ou `request.title`)
*   **Campos Opcionais**: `priority`, `description` (ou `notes`), `areaRef`, `projectRef`, `requestedBy`
*   **Exige Approval**: Não
*   **Exige Clarification**: Sim, sem título.
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_tasks`
*   **Efeito Esperado na UI**: Renderizado instantaneamente em `/pulso/tarefas` com contadores dinâmicos, e propagado nos drawers de Área e Projeto.
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)
*   **Observações de Risco**: O backend executa purga profunda de chaves indefinidas para garantir segurança no array de `ownerRefs`.

### `update_task` / `complete_task` / `archive_task`
*   **Entidade Afetada**: Tarefas
*   **Operação**: Ciclo de Vida Operacional
*   **Campos Mínimos Obrigatórios**: `taskRef` (ou `title` resolvível via query local)
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `reopen_task` / `unarchive_task`
*   **Status Atual**: 🟡 **Amarelo** (Parcial - Pode ser suprido via `update_task` com injeção de `status: 'new'` e `archived: false`, mas carece de endpoint dedicado atômico).

### `link_task_to_project` / `link_task_to_area`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

---

## 4. Projetos (`pulso_projects`)

### `create_project`
*   **Entidade Afetada**: Projetos
*   **Operação**: Criação (Create)
*   **Campos Mínimos Obrigatórios**: `payload.name`
*   **Campos Opcionais**: `priority`, `objective`, `areaRef`
*   **Exige Approval**: Não (desde que ancorado em Área existente).
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_projects`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `update_project` / `archive_project` / `change_project_status` / `change_project_priority` / `link_project_to_area`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário)

### `reopen_project` / `unarchive_project` / `complete_project`
*   **Status Atual**: 🟡 **Amarelo** (Parcial - Executável de forma genérica via `update_project` ou `change_project_status`).

---

## 5. Áreas (`pulso_areas`)

### `create_area`
*   **Entidade Afetada**: Áreas
*   **Operação**: Criação Estrutural
*   **Campos Mínimos Obrigatórios**: `payload.name`
*   **Campos Opcionais**: `type`, `priority`
*   **Exige Approval**: **Sim**. O backend joga compulsoriamente para `needs_approval` se a chave `payload.trusted` não for estritamente `true`.
*   **Coleção de Destino**: `workspaces/felipe_dutra/pulso_areas`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário sob governança assistida)

### `update_area` / `archive_area` / `unarchive_area`
*   **Status Atual**: 🔴 **Vermelho** (Não operar ainda - Ausentes da Bridge).

---

## 6. Decisões e Alertas (`pulso_decisions` / `pulso_alerts`)

### `register_decision` / `create_alert`
*   **Status Atual**: 🟢 **Verde** (Pronto para uso diário - Criação autônoma com mapeamento completo de chaves).

### `update_decision` / `archive_decision` / `update_alert` / `resolve_alert` / `acknowledge_alert`
*   **Status Atual**: 🔴 **Vermelho** (Não operar ainda - Sem suporte de mutação no *controller* da bridge externa).

---

## 7. Agentes e Rotinas (`pulso_agents` / `pulso_routines`)

### `create_agent`
*   **Status Atual**: 🟡 **Amarelo** (Parcial - O *controller* intercepta e suspende em `needs_approval` de forma segura, mas a interface visual para ativação de blueprints com um clique ainda requer acabamento).

### Manutenção de Rotinas (`create_routine`, `pause_routine`, etc.)
*   **Status Atual**: 🔴 **Vermelho** (Não operar ainda - Nenhuma rota aberta na Requests Bridge para a Lótus/OpenClaw).
