# Requests Bridge Operational Kit: Especificação e Manual de Integração

Este manual consolida a interface operacional, os contratos técnicos e as rotas canônicas da **Requests Bridge**. Seu objetivo é fornecer à Lótus/OpenClaw as ferramentas de interação programática para orquestrar o ciclo de vida completo de intenções operacionais e atestar de forma rastreável a sua respectiva **Materialização Canônica** no ecossistema PULSO.

---

## 1. Base URL Real da Requests Bridge
Todas as chamadas de integração devem ser roteadas para a Cloud Function canônica de produção:

*   **URL Base da Cloud Function**: `https://us-central1-felipedutraapps.cloudfunctions.net/pulsoRequests`
*   **URL Base via Rewrite (PULSO API)**: `https://felipedutraapps.web.app/api/pulso/requests`

---

## 2. Autenticação
O acesso operacional é estritamente autorizado mediante verificação de token no cabeçalho HTTP da requisição.

*   **Formato do Header**: `Authorization: Bearer <TOKEN>`
*   **Variável de Ambiente Esperada**: `PULSO_INGEST_TOKEN`
*   **Exemplo Canônico**:
    ```http
    Authorization: Bearer $PULSO_INGEST_TOKEN
    ```

---

## 3. Endpoints Reais Disponíveis

A ponte expõe os seguintes endpoints REST sob a Base URL para o controle transacional do ciclo de vida das solicitações:

| Endpoint | Método | Descrição | Resposta de Sucesso |
| :--- | :--- | :--- | :--- |
| `/create` | `POST` | Cria nova solicitação operacional com suporte a deduplicação | `201 Created` / `200 OK` (Duplicate) |
| `/pending` | `GET` | Lista solicitações com status `requested` aguardando triagem | `200 OK` (Array de objetos) |
| `/claim` | `POST` | Aplica lock transacional na solicitação (`running`) | `200 OK` (`claimed`) |
| `/complete` | `POST` | Finaliza a solicitação e aciona a materialização canônica | `200 OK` (`completed`) |
| `/fail` | `POST` | Sinaliza erro técnico ou falha irrecuperável de processamento | `200 OK` (`failed`) |
| `/needs-clarification` | `POST` | Pausa solicitação aguardando esclarecimento ou dados extras | `200 OK` (`needs_clarification`) |
| `/needs-approval` | `POST` | Pausa solicitação exigindo aprovação estrutural/governança | `200 OK` (`needs_approval`) |
| `/:id` | `GET` | Consulta o documento de uma solicitação específica por ID | `200 OK` (Objeto completo com result) |

---

## 4. Exemplos cURL de Operação

### 4.1 Criar `register_person`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_person",
    "title": "Registrar Stakeholder: Mariana",
    "summary": "Captura autônoma de contato.",
    "priority": "medium",
    "areaRef": "area_openclaw",
    "requestedBy": "agent_lotus",
    "dedupeKey": "person_mariana_999",
    "origin": { "channel": "whatsapp", "source": "openclaw" },
    "payload": {
      "name": "Mariana",
      "role": "Consultora Externa",
      "attentionLevel": "high",
      "notes": "Parceira estratégica de processos."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.2 Criar `register_source`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_source",
    "title": "Registrar Fonte: Planilha Base",
    "summary": "Planilha financeira unificada.",
    "priority": "high",
    "requestedBy": "agent_lotus",
    "dedupeKey": "source_planilha_base_001",
    "payload": {
      "name": "Planilha Financeira Unificada",
      "type": "google_sheets",
      "url": "https://docs.google.com/spreadsheets/d/abc123xyz",
      "relevance": "critical"
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.3 Criar `create_task`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "create_task",
    "title": "Estruturar Relatório Semanal",
    "priority": "high",
    "requestedBy": "agent_lotus",
    "dedupeKey": "task_relatorio_001",
    "payload": {
      "title": "Estruturar Relatório Semanal",
      "description": "Compilar avanços das obras e finanças operacionais."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.4 Listar Pendentes (`pending`)
```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/pending?limit=5"
```

### 4.5 Fazer Lock (`claim`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_123456", "processedBy": "openclaw_agent"}' \
  "https://felipedutraapps.web.app/api/pulso/requests/claim"
```

### 4.6 Concluir e Materializar (`complete`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_123456", "result": {"status": "success"}}' \
  "https://felipedutraapps.web.app/api/pulso/requests/complete"
```

### 4.7 Consultar Request por ID
```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/req_123456"
```

### 4.8 Operações de Manutenção Diária (Maturidade Operacional)

> [!IMPORTANT]
> **Regra de Ouro de Manutenção Canônica (Validada pela OpenClaw)**
> Toda operação de manutenção no barramento deve utilizar estritamente o `entityRef` real retornado no envelope da criação ou localizado por meio de leitura canônica prévia e confiável. **É expressamente vedado** o uso de referências presumidas, *slugs* deduzidos ou nomes convertidos por *workarounds* manuais.
> 
> *A bateria encadeada de testes certificou com sucesso absoluto as operações de `register/create`, `update` e `archive` para as entidades **Pessoas**, **Fontes**, **Projetos** e **Tarefas** consumindo a chave primária real.*
> 
> *Nota de Retorno Semântico (`archive_*`)*: As operações encarregadas de deleção lógica (`archive_person`, `archive_project`, etc.) encerram o ciclo de vida e retornam na chave de auditoria `result.action = "updated"`, contudo, persistem no Firestore as chaves `archived: true` e `status` como `"inactive"` ou `"archived"` com 100% de precisão atômica. Essa discrepância puramente semântica no *string literal* de retorno **não é considerada um bloqueio da v1.0**, restando tipificada como um refinamento futuro para o *controller*.

Exemplos de envio de intenções para atualização, arquivamento e vinculação de entidades sem deleção física.

#### Atualizar Projeto (`update_project`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "update_project",
    "title": "Atualizar status e prioridade de Projeto",
    "projectRef": "proj_reforma_escritorio",
    "requestedBy": "agent_lotus",
    "payload": {
      "patch": {
        "status": "in_progress",
        "priority": "high",
        "nextStep": "Aprovar orçamento elétrico final"
      },
      "reason": "Revisão estratégica semanal."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Arquivar Projeto (`archive_project`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "archive_project",
    "title": "Arquivar Projeto Concluído",
    "projectRef": "proj_reforma_escritorio",
    "requestedBy": "agent_lotus",
    "payload": {
      "reason": "Escopo entregue e faturado."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Atualizar Pessoa (`update_person`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "update_person",
    "title": "Atualizar cargo de Stakeholder",
    "personRef": "person_mariana",
    "requestedBy": "agent_lotus",
    "payload": {
      "patch": {
        "role": "Diretora de Operações",
        "importance": "critical"
      },
      "reason": "Promovida recentemente."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Arquivar Pessoa (`archive_person`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "archive_person",
    "title": "Inativar contato no ecossistema",
    "personRef": "person_mariana",
    "requestedBy": "agent_lotus",
    "payload": {
      "reason": "Desvinculada do projeto central."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Vincular Pessoa a Projeto (`link_person_to_project`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "link_person_to_project",
    "title": "Vincular Mariana ao Projeto de Reforma",
    "personRef": "person_mariana",
    "projectRef": "proj_reforma_escritorio",
    "requestedBy": "agent_lotus"
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Concluir Tarefa (`complete_task`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "complete_task",
    "title": "Marcar tarefa como entregue",
    "taskRef": "task_1715000000000",
    "requestedBy": "agent_lotus",
    "payload": {
      "reason": "Aprovado via WhatsApp."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Arquivar Tarefa (`archive_task`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "archive_task",
    "title": "Esconder tarefa cancelada",
    "taskRef": "task_1715000000000",
    "requestedBy": "agent_lotus"
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Atualizar Fonte (`update_source`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "update_source",
    "title": "Atualizar URL de repositório",
    "sourceRef": "source_planilha_base",
    "requestedBy": "agent_lotus",
    "payload": {
      "patch": {
        "url": "https://docs.google.com/spreadsheets/d/nova_url_123"
      }
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

#### Arquivar Fonte (`archive_source`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "archive_source",
    "title": "Desativar fonte legada",
    "sourceRef": "source_planilha_base",
    "requestedBy": "agent_lotus"
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

---

## 5. Shape Real do Request e do Result

### Shape de Entrada Canônico
```json
{
  "id": "req_123456",
  "requestType": "register_person",
  "title": "Registrar Stakeholder: Mariana",
  "summary": "Captura autônoma de contato.",
  "status": "requested",
  "priority": "medium",
  "requestedBy": "agent_lotus",
  "dedupeKey": "person_mariana_999",
  "origin": {
    "channel": "whatsapp",
    "source": "openclaw"
  },
  "payload": {
    "name": "Mariana",
    "role": "Consultora Externa"
  },
  "requestedAt": "2026-05-12T10:00:00.000Z"
}
```

### Shape do Objeto de Resultado (`result`) após Conclusão
Quando a transação aciona o Dispatcher de Materialização e conclui com sucesso, a chave `result` contém a auditoria de destino:
```json
{
  "status": "success",
  "entityRef": "person_mariana",
  "entityPath": "workspaces/felipe_dutra/pulso_people/person_mariana",
  "matResult": {
    "ok": true,
    "action": "created",
    "entityType": "person",
    "entityRef": "person_mariana",
    "entityPath": "workspaces/felipe_dutra/pulso_people/person_mariana",
    "summary": "Entidade materializada."
  }
}
```
*Se houver falha de validação estrutural:*
```json
{
  "ok": false,
  "action": "needs_clarification",
  "summary": "Nome é obrigatório.",
  "missingFields": ["name"],
  "error": "Validação falhou por ausência de payload obrigatório."
}
```

---

## 6. Paths Canônicos de Coleções no Firestore
A Lótus/OpenClaw deve utilizar os seguintes caminhos exatos sob o escopo do workspace para inspecionar os documentos canônicos materializados:

*   **Ponte de Intenções**: `workspaces/felipe_dutra/pulso_requests`
*   **Pessoas**: `workspaces/felipe_dutra/pulso_people`
*   **Fontes**: `workspaces/felipe_dutra/pulso_sources`
*   **Tarefas**: `workspaces/felipe_dutra/pulso_tasks`
*   **Decisões**: `workspaces/felipe_dutra/pulso_decisions`
*   **Alertas**: `workspaces/felipe_dutra/pulso_alerts`
*   **Projetos**: `workspaces/felipe_dutra/pulso_projects`
*   **Áreas**: `workspaces/felipe_dutra/pulso_areas`
*   **Agentes**: `workspaces/felipe_dutra/pulso_agents`
*   **Rotinas**: `workspaces/felipe_dutra/pulso_routines`

---

## 7. Critério de Certificação Externa
> **IMPORTANTE**: A materialização geral não deve ser declarada como "validada pela OpenClaw" na documentação de status técnico até que a própria OpenClaw consuma as chaves `entityRef` e `entityPath` retornadas neste kit e prove a existência efetiva do documento gravado de forma autônoma na respectiva coleção canônica.

---

## 8. Protocolos de Consumo pela OpenClaw

Para assegurar estabilidade, rastreabilidade e governança impecável na comunicação assíncrona, a Lótus/OpenClaw deve seguir os protocolos contratuais descritos abaixo.

### 8.1 RequestTypes Autorizados (Modo Automático)
Podem ser concluídos sem aprovação prévia de governança desde que seus campos obrigatórios mínimos estejam presentes:
*   `register_person` (Obrigatório: `name`)
*   `register_source` (Obrigatório: `name`, `type`, `url`)
*   `create_task` (Obrigatório: `title` ou `name`)
*   `register_decision` (Obrigatório: `title`)
*   `create_alert` (Obrigatório: `title`)
*   `create_project` (Obrigatório: `name`, `areaRef`, não colidir com ID existente ou prover `dedupeKey`)

### 8.2 RequestTypes que Exigem Aprovação Humana (`needs_approval`)
Sempre interceptados pelo materializador para validação de governança:
*   `create_agent` — Sempre encaminhado para `needs_approval` a fim de evitar a injeção programática de atores ativos autônomos sem revisão.
*   `create_area` — Encarada como modificação estrutural pesada. Requer aprovação prévia, salvo se enviada em modo confiável explícito (`"trusted": true`).

### 8.3 Erros Comuns de Roteamento e Payload
1.  **Ausência de `dedupeKey` em fluxos reativos**: Interações de mensageria (ex: WhatsApp) frequentemente emitem duplos disparos. A falta de `dedupeKey` gera poluição de registros.
2.  **Passagem de `Timestamp` não serializado**: Passar objetos de data puros ao invés de strings ISO quebra decodificadores JSON em rotas REST.
3.  **Inconsistência de IDs Canônicos**: Omissão de prefixos de coleção em `areaRef` ou `projectRef` impede o link do barramento visual na interface.

### 8.4 Política Canônica de Emissão para `pulso_events`
> **REGRA DE OURO**: **Request não é igual a evento**. A criação, processamento ou checagem de uma solicitação representa uma *intenção transacional*, não uma alteração de estado do ecossistema.

A OpenClaw **SÓ DEVE** emitir um evento para a coleção `pulso_events` quando ocorrer uma **mudança real de estado com impacto no negócio**, tais como:
*   Tarefa de **alta prioridade** ou crítica criada.
*   Decisão estratégica formalmente registrada.
*   Alerta ou risco severo disparado no radar.
*   Projeto mudou de estágio ou de status operacional.
*   Agente solicitou aprovação estrutural com impacto direto em workflows.

**NÃO EMITIR EVENTO PARA:**
*   Testes de rotina ou automações de health check.
*   Leitura, listagem (`pending`) ou polling de solicitações.
*   Locks transacionais simples (`claim`).
*   Conclusão de requests sem alteração material ou de baixo impacto.
*   Cadastros acessórios simples sem relevância imediata para as áreas de foco.

