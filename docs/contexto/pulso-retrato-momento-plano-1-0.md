# PULSO
## Retrato do Momento e Plano de Fechamento para v1.0

Documento vivo para subir no repositório do projeto e usar como base de auditoria, desenvolvimento e alinhamento entre Fê, Lótus/OpenClaw e Antigravity.

---

## 1. Objetivo do documento

Consolidar o estado real do PULSO, organizar os ajustes pendentes e definir o caminho objetivo para fechar a plataforma em uma versão utilizável no dia a dia antes de avançar para voz.

Este documento não é um histórico completo de tudo que já foi feito. Ele é um retrato operacional do momento atual e um plano para a próxima fase.

A documentação histórica e replicável do método deverá virar uma frente paralela própria.

---

## 2. Síntese do momento

O PULSO deixou de ser apenas um painel visual e passou a ter uma camada operacional real.

Hoje já existe uma ponte funcional entre:

- PULSO UI
- Firebase / Firestore
- Requests Bridge
- Lótus / OpenClaw
- Google Sheets canônicas
- Barramento de eventos

O ponto central agora não é mais provar se a Lótus consegue falar com o PULSO. Isso foi validado.

O desafio atual é transformar essa estrutura em um sistema confiável, claro, auditável, replicável e usável no dia a dia.

A pergunta deixou de ser:

> Será que funciona?

E passou a ser:

> Quais ações a Lótus pode executar, com quais campos, em quais entidades, com qual nível de autonomia, com qual aprovação e com qual reflexo visual no PULSO?

---

## 3. Estado real consolidado

### 3.1 Requests Bridge

A Requests Bridge está operacional.

A Lótus / OpenClaw consegue chamar:

- `/create`
- `/pending`
- `/claim`
- `/complete`
- `/needs-clarification`
- `/needs-approval`
- `/:id`

Isso permite:

- criar requests reais
- listar pendentes
- claimar
- completar
- pedir esclarecimento
- pedir aprovação
- consultar request posteriormente

### 3.2 Entidades já materializadas com sucesso

A Lótus / OpenClaw já validou materialização canônica em:

- `register_person` -> `pulso_people`
- `register_source` -> `pulso_sources`
- `create_task` -> `pulso_tasks`
- `create_project` -> `pulso_projects`
- `register_decision` -> `pulso_decisions`
- `create_alert` -> `pulso_alerts`

### 3.3 Governança já validada

As ações sensíveis já caem corretamente em aprovação:

- `create_area` -> `needs_approval`
- `create_agent` -> `needs_approval`
- request incompleto -> `needs_clarification`

Esse desenho é correto.

A Lótus pode operar, mas não deve ter liberdade total para alterar a arquitetura central sem confirmação humana.

### 3.4 O que ainda está parcial

A manutenção fina ainda precisa ser fechada e homologada:

- atualizar entidades
- arquivar entidades
- reabrir entidades
- vincular entidades
- desvincular entidades
- concluir tarefas
- reabrir tarefas
- arquivar tarefas
- aprovar ou reprovar solicitações de forma simples

A diferença importante:

- O Antigravity enxerga o que existe no código, backend e UI.
- A Lótus / OpenClaw enxerga o que consegue provar operando de fora.
- A verdade operacional precisa vir do cruzamento dos dois.

---

## 4. Princípio arquitetural

### 4.1 O PULSO não deve tentar ser tudo de uma vez

O PULSO deve ser a central viva de estado, decisão, acompanhamento e operação.

Mas nem todo dado precisa nascer, viver e morrer exclusivamente dentro dele neste momento.

Arquitetura segura agora:

- **Google Sheets:** base canônica operacional quando o domínio exigir flexibilidade, especialmente no Financeiro Casa.
- **PULSO:** cockpit, estado, sinal, visualização, fila de solicitações, governança e registros canônicos de entidades maduras.
- **Lótus / OpenClaw:** agente executor, organizador, auditor e operador externo.
- **Requests Bridge:** contrato operacional entre agente externo e PULSO.
- **Barramento:** sinais de estado real, não log de tudo.

### 4.2 Regra de ouro do barramento

Nem toda ação vira evento.

O barramento deve receber apenas mudanças reais de estado ou sinais relevantes.

Não emitir para `pulso_events` em operações comuns como:

- cadastro simples
- microajuste
- request completo sem mudança real
- leitura saudável
- sincronização sem alteração

Emitir apenas para:

- decisão relevante
- alerta
- mudança de projeto
- risco
- tarefa crítica
- mudança real de estado operacional

---

## 5. Política de autonomia da Lótus / OpenClaw

### 5.1 Ações que podem ser automáticas

A Lótus pode executar automaticamente, desde que os campos mínimos estejam presentes:

- criar pessoa
- atualizar pessoa
- arquivar pessoa
- criar fonte
- atualizar fonte
- arquivar fonte
- criar tarefa
- atualizar tarefa
- concluir tarefa
- arquivar tarefa
- criar decisão
- criar alerta
- criar projeto dentro de área existente
- atualizar projeto existente
- arquivar projeto de teste ou projeto explicitamente autorizado
- vincular pessoa a projeto
- desvincular pessoa de projeto
- vincular fonte a projeto
- desvincular fonte de projeto

### 5.2 Ações que exigem aprovação

Exigem aprovação humana:

- criar área nova
- arquivar área
- criar agente
- ativar agente
- alterar nível de autonomia de agente
- deletar fisicamente qualquer entidade
- mover grande volume de dados
- apagar histórico
- executar ação irreversível
- emitir alerta crítico externo
- alterar contrato de operação

### 5.3 Aprovação precisa ser prática

Aprovação não pode virar burocracia.

Fluxo ideal:

1. Lótus identifica uma ação sensível.
2. Cria request com `status: needs_approval`.
3. PULSO mostra a solicitação em uma área clara de Aprovações.
4. Fê pode aprovar por botão na UI, comando no WhatsApp ou comando de voz no futuro.

Comandos esperados:

- `aprovar request req_x`
- `reprovar request req_x`
- `aprovar criação da área Financeiro Casa`
- `aprovar e executar`
- `não aprovar, arquivar solicitação`
- `pedir mais detalhes`

---

## 6. Operações essenciais por entidade

Toda entidade operacional precisa suportar, quando fizer sentido:

- criar
- atualizar
- arquivar
- reabrir
- visualizar detalhe
- buscar
- filtrar
- vincular
- desvincular
- registrar origem
- registrar autoria
- registrar data de criação
- registrar data de atualização
- registrar histórico mínimo

### 6.1 Deleção física

Deleção física não deve ser operação padrão.

Padrão:

- `archived: true`
- `archivedAt`
- `archivedBy`
- `archiveReason`

Deletar fisicamente só com comando explícito e confirmação forte.

---

## 7. Modelo de dados por entidade

## 7.1 Pessoas

Pessoas são mais do que contatos. Elas são nós de relacionamento, contexto, oportunidade, risco e memória.

### Campos básicos

- `id`
- `name`
- `slug`
- `status`
- `role`
- `profession`
- `company`
- `email`
- `phone`
- `whatsapp`
- `instagram`
- `linkedin`
- `website`
- `city`
- `country`
- `createdAt`
- `updatedAt`
- `archived`

### Campos relacionais

- `areaRefs`
- `projectRefs`
- `sourceRefs`
- `taskRefs`
- `decisionRefs`
- `relatedPeopleRefs`

### Campos estratégicos

- `relationshipLevel`
- `relationshipType`
- `networkValue`
- `attentionLevel`
- `trustLevel`
- `influenceLevel`
- `commercialPotential`
- `partnershipPotential`
- `creativePotential`
- `riskLevel`

### Campos subjetivos

- `notes`
- `personalContext`
- `knownSkills`
- `interests`
- `sensitiveTopics`
- `communicationStyle`
- `lastInteractionSummary`
- `relationshipHistory`
- `opportunityNotes`
- `followUpNotes`

### Campos de acompanhamento

- `lastContactAt`
- `nextContactAt`
- `followUpCadence`
- `followUpReason`
- `importantDates`
- `openLoops`
- `pendingPromises`
- `lastMessageChannel`

### Uso prático

A Lótus deve conseguir:

- registrar uma pessoa a partir de conversa
- atualizar dados de contato
- vincular pessoa a projeto
- classificar relação
- criar lembrete de contato
- avisar quando alguém importante estiver sem contato há muito tempo
- sugerir mensagem
- registrar histórico de conversa relevante
- arquivar contato sem apagar histórico

## 7.2 Projetos

Projetos são frentes vivas de execução.

### Campos básicos

- `id`
- `name`
- `slug`
- `description`
- `status`
- `priority`
- `areaRef`
- `createdAt`
- `updatedAt`
- `archived`

### Campos operacionais

- `stage`
- `goal`
- `currentFocus`
- `nextStep`
- `deadline`
- `startedAt`
- `completedAt`
- `ownerRefs`
- `stakeholderRefs`
- `sourceRefs`
- `taskRefs`
- `decisionRefs`
- `alertRefs`

### Campos estratégicos

- `whyItMatters`
- `successCriteria`
- `risks`
- `constraints`
- `dependencies`
- `budget`
- `businessImpact`
- `emotionalWeight`

### Uso prático

A Lótus deve conseguir:

- criar projeto em área existente
- atualizar status
- atualizar prioridade
- registrar próximo passo
- vincular pessoas
- vincular fontes
- criar tarefas do projeto
- registrar decisões
- alertar sobre risco
- arquivar projeto
- reabrir projeto

Criar projeto dentro de área existente pode ser automático.

Criar área nova para projeto exige aprovação.

## 7.3 Áreas

Áreas são estruturas de vida, negócio ou operação.

### Campos básicos

- `id`
- `name`
- `slug`
- `description`
- `status`
- `priority`
- `type`
- `createdAt`
- `updatedAt`
- `archived`

### Campos de estrutura

- `projectRefs`
- `peopleRefs`
- `sourceRefs`
- `taskRefs`
- `agentRefs`
- `routineRefs`

### Campos de governança

- `ownerRef`
- `visibility`
- `sensitivityLevel`
- `requiresApprovalForNewProjects`
- `requiresApprovalForAgents`

### Uso prático

A Lótus deve conseguir sugerir área, mas não criar área estrutural automaticamente sem aprovação.

## 7.4 Tarefas

Tarefas são ações executáveis, não apenas notas soltas.

### Campos básicos

- `id`
- `title`
- `description`
- `status`
- `priority`
- `areaRef`
- `projectRef`
- `ownerRefs`
- `createdAt`
- `updatedAt`
- `completedAt`
- `archived`

### Campos de execução

- `dueDate`
- `startDate`
- `cadence`
- `source`
- `channel`
- `requestedBy`
- `takenByRefs`
- `blockedBy`
- `blockReason`
- `nextAction`

### Campos de rastreabilidade

- `requestId`
- `sourceMessageRef`
- `originChannel`
- `originSummary`
- `decisionRef`
- `eventRef`

### Uso prático

A Lótus deve conseguir:

- criar tarefa
- atualizar tarefa
- concluir tarefa
- reabrir tarefa
- arquivar tarefa
- vincular a projeto
- vincular a pessoa
- listar tarefas abertas
- avisar sobre tarefas vencidas
- transformar decisão em tarefa

## 7.5 Fontes

Fontes são lugares de informação, prova, documentação ou entrada operacional.

### Campos básicos

- `id`
- `name`
- `slug`
- `type`
- `url`
- `description`
- `status`
- `priority`
- `createdAt`
- `updatedAt`
- `archived`

### Campos operacionais

- `syncMode`
- `lastSyncAt`
- `nextSyncAt`
- `syncStatus`
- `ownerRef`
- `areaRefs`
- `projectRefs`
- `accessNotes`
- `credentialStatus`
- `reliabilityLevel`

### Uso prático

A Lótus deve conseguir:

- registrar fonte
- atualizar fonte
- vincular fonte a área
- vincular fonte a projeto
- desvincular
- registrar observações de acesso
- avisar quando fonte falhar
- arquivar fonte

## 7.6 Decisões

Decisões são marcos. Elas não devem se perder no fluxo.

### Campos básicos

- `id`
- `title`
- `description`
- `decisionText`
- `status`
- `areaRef`
- `projectRef`
- `decidedByRefs`
- `createdAt`
- `updatedAt`
- `archived`

### Campos contextuais

- `reason`
- `alternativesConsidered`
- `impact`
- `risk`
- `followUpTaskRefs`
- `sourceRefs`
- `meetingRef`
- `conversationRef`

### Uso prático

A Lótus deve conseguir:

- registrar decisão a partir de conversa
- vincular decisão a projeto
- criar tarefa derivada
- emitir evento apenas quando a decisão alterar estado real
- buscar decisões antigas

## 7.7 Alertas

Alertas são sinais que pedem atenção.

### Campos básicos

- `id`
- `title`
- `description`
- `severity`
- `status`
- `areaRef`
- `projectRef`
- `sourceRef`
- `createdAt`
- `updatedAt`
- `resolvedAt`
- `archived`

### Campos operacionais

- `triggerType`
- `detectedBy`
- `recommendedAction`
- `riskIfIgnored`
- `ownerRef`
- `relatedTaskRef`
- `eventRef`

### Uso prático

A Lótus deve conseguir:

- criar alerta
- atualizar severidade
- marcar como reconhecido
- marcar como resolvido
- arquivar
- emitir no barramento quando for relevante

## 7.8 Agentes

Agentes são capacidades operacionais. Devem ter governança forte.

### Campos básicos

- `id`
- `name`
- `slug`
- `role`
- `description`
- `status`
- `priority`
- `createdAt`
- `updatedAt`
- `archived`

### Campos de autonomia

- `autonomyLevel`
- `requiresApproval`
- `allowedActions`
- `blockedActions`
- `systems`
- `inputTypes`
- `outputTypes`
- `cadence`
- `ownerRef`
- `areaRefs`
- `projectRefs`

### Campos de segurança

- `limits`
- `knownRisks`
- `lastActivityAt`
- `lastAuditAt`
- `failureCount`
- `approvalPolicy`

### Uso prático

Criar agente nunca deve ativar o agente imediatamente.

O fluxo correto:

1. Lótus propõe blueprint do agente.
2. Request cai em `needs_approval`.
3. Fê aprova.
4. Sistema cria ou ativa agente.
5. O agente fica registrado em Metabolismo.

## 7.9 Rotinas

Rotinas são execuções recorrentes.

### Campos básicos

- `id`
- `name`
- `description`
- `status`
- `frequency`
- `schedule`
- `areaRef`
- `projectRef`
- `agentRef`
- `createdAt`
- `updatedAt`
- `archived`

### Campos operacionais

- `lastRunAt`
- `nextRunAt`
- `lastResult`
- `failureCount`
- `successCount`
- `triggerType`
- `outputDestination`
- `requiresApproval`

## 7.10 Solicitações

Solicitações são o coração da operação assistida.

### Campos básicos

- `id`
- `requestType`
- `status`
- `title`
- `summary`
- `payload`
- `priority`
- `requestedBy`
- `processedBy`
- `createdAt`
- `updatedAt`
- `processedAt`
- `completedAt`
- `archived`

### Campos de controle

- `dedupeKey`
- `requestHash`
- `batchId`
- `source`
- `channel`
- `originMessageRef`
- `areaRef`
- `projectRef`

### Campos de resultado

- `result.action`
- `result.entityType`
- `result.entityRef`
- `result.entityPath`
- `result.summary`
- `result.missingFields`
- `result.error`
- `matResult`

---

## 8. Ajustes pendentes já identificados

### 8.1 Solicitações quebrando

Correções esperadas:

- parser seguro de datas
- fallback visual
- nenhum request malformado pode quebrar a UI
- status claros
- botão de arquivar teste
- detalhe com `result.entityRef` e `result.entityPath`

### 8.2 Mobile com overflow lateral

Correções esperadas:

- barra de navegação horizontal com overflow controlado
- body sem overflow-x
- botões com scroll horizontal próprio quando necessário
- filtros com scroll horizontal próprio
- botão de sair fixo sem empurrar largura
- drawers adaptados ao viewport mobile

### 8.3 Filtros

Filtros desejáveis:

- status
- prioridade
- área
- projeto
- pessoa
- fonte
- data
- origem
- tipo
- arquivado / ativo

### 8.4 Dados de teste

Regra:

- não deletar fisicamente
- arquivar testes
- preservar histórico técnico quando útil
- esconder testes da visão padrão
- manter filtro “Testes / Arquivados” para auditoria

---

## 9. Plano de fechamento para v1.0

### Fase 0 - Congelar diagnóstico

Consolidar o retrato real do PULSO e evitar desenvolvimento em cima de fantasia.

### Fase 1 - Contrato operacional canônico

Definir exatamente o que cada requestType recebe, faz e retorna.

### Fase 2 - CRUD seguro das entidades principais

Permitir que Lótus coloque, tire, atualize e organize coisas no PULSO.

### Fase 3 - Aprovação simples e prática

Transformar `needs_approval` em uma experiência simples por UI, WhatsApp e futuramente voz.

### Fase 4 - UI de uso diário

Garantir que a plataforma seja usável de verdade.

### Fase 5 - Operação real assistida

Começar a usar oficialmente o PULSO no dia a dia.

### Fase 6 - Financeiro Casa como piloto disciplinado

Usar o Financeiro Casa como primeiro caso real de operação viva, sem transformar o PULSO em app financeiro completo cedo demais.

### Fase 7 - Fechamento v1.0

Declarar o PULSO pronto para uso real básico.

---

## 10. Versionamento proposto

### v0.1

Protótipo visual inicial.

### v0.5

Primeira camada funcional.

### v0.8

Requests Bridge operacional.

### v0.9

Pré-v1.0.

Status desejado:

- contrato operacional consolidado
- manutenção fina homologada
- UI corrigida
- aprovação prática
- mobile estabilizado
- testes arquivados
- campos das entidades definidos

### v1.0

Primeira versão oficial de trabalho.

Definição:

O PULSO pode ser aberto diariamente e usado como cockpit operacional real.

### v1.5

Operação real expandida.

Inclui Financeiro Casa, rotinas recorrentes, logs melhores, relatórios e integrações.

### v2.0

Camada de voz.

Definição:

A voz passa a ser uma interface central de operação.

---

## 11. Padrão de documentação daqui para frente

Precisamos criar uma metodologia de documentação replicável.

Cada bloco relevante do PULSO deve gerar pelo menos estes documentos:

1. **Retrato do Momento**
   - estado atual
   - o que funciona
   - o que não funciona
   - riscos
   - decisões

2. **Contrato Técnico**
   - endpoints
   - coleções
   - requestTypes
   - payloads
   - retornos
   - regras de segurança

3. **Manual Operacional**
   - como usar
   - como testar
   - como aprovar
   - como corrigir
   - como replicar

4. **Histórico de Decisões**
   - o que foi decidido
   - por quê
   - por quem
   - quando

5. **Checklist de Replicação**
   - pré-requisitos
   - estrutura de pastas
   - variáveis de ambiente
   - Firebase
   - Firestore
   - Functions
   - Sheets
   - OpenClaw
   - prompts
   - testes
   - deploy

Pasta sugerida dentro do repositório:

```txt
docs/contexto/
  pulso-retrato-momento-plano-1-0.md
  pulso-metodologia-documentacao-replicavel.md
  pulso-operational-kit.md
  pulso-requests-bridge-contract.md
  pulso-decision-log.md
```

---

## 12. Prompt padrão para o Antigravity daqui para frente

Todo prompt técnico para o Antigravity deve exigir:

- análise antes de execução
- build
- deploy quando necessário
- commit
- push
- git status limpo
- relatório objetivo

Checklist obrigatório no fim:

- build passou?
- deploy foi feito?
- quais targets foram deployados?
- commit criado?
- hash do commit?
- push concluído?
- git status ficou limpo?
- houve alteração em functions?
- houve alteração em rules?
- produção está atualizada?

---

## 13. Prompt padrão para a Lótus / OpenClaw daqui para frente

Todo teste com a Lótus deve exigir:

- requestId
- requestType
- dedupeKey
- status inicial
- claim
- status final
- result.action
- result.entityType
- result.entityRef
- result.entityPath
- se materializou
- se emitiu evento indevido
- se apareceu ou deveria aparecer na UI
- erro exato quando falhar

Observação importante:

A Lótus / OpenClaw não deve receber comando como se estivesse 100% dedicada apenas ao PULSO.

Ela está orquestrando várias frentes. O ideal é falar com ela como camada operacional externa, pedindo auditoria, leitura, teste ou execução específica.

No futuro, deverá existir um agente dedicado ao PULSO, com cronos, rotinas e responsabilidades próprias.

---

## 14. Ordem objetiva dos próximos passos

1. Conferir e fechar o contrato real de manutenção.
2. Definir campos mínimos das entidades principais.
3. Ajustar UI para refletir os campos reais.
4. Estabilizar aprovação prática.
5. Rodar bateria real com Lótus / OpenClaw.
6. Limpar testes.
7. Assumir v0.9.
8. Usar em rotina real por alguns dias.
9. Declarar v1.0.
10. Entrar em voz.

---

## 15. Definição de “fim” deste bloco

O fim desta etapa não é o PULSO perfeito.

O fim é:

- PULSO confiável para uso diário básico
- Lótus capaz de operar criação e manutenção comum
- aprovação simples para ações sensíveis
- campos essenciais definidos
- UI mostrando o que importa
- mobile sem quebrar
- dados de teste arquivados
- contrato documentado
- Git e produção alinhados

Quando isso acontecer, podemos chamar de:

> PULSO v1.0

A partir daí, entramos na camada de voz como:

> PULSO v2.0

---

## 16. Decisão recomendada agora

Não avançar para voz ainda.

Antes, fechar:

1. contrato de manutenção
2. campos das entidades
3. aprovação prática
4. UI de Solicitações
5. mobile
6. limpeza de testes
7. rotina real mínima

Depois disso, a voz entra como uma camada natural, não como uma gambiarra mágica em cima de um sistema ainda instável.

A voz deve acelerar a operação, não acelerar a bagunça.
