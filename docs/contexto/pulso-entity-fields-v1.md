# PULSO v1.0: Definição Canônica e Universal de Campos por Entidade

Este manual de arquitetura consolida o modelo de dados final mínimo exigido para o ecossistema **PULSO v1.0**, estabelecendo o limite absoluto e inegociável entre os vetores brutos de tráfego do barramento e os atributos de estado vivo no Cockpit Operacional.

Cada propriedade de todas as entidades do sistema é exaustivamente classificada com os seguintes carimbos de governança técnica:
*   **[Obrigatório]**: Chave estrutural crítica para o tráfego da Bridge, indexação no Firestore e materialização de chaves primárias.
*   **[Opcional]**: Atributo de conveniência ou contato secundário.
*   **[Estratégico]**: Métrica de alto valor relacional, preditiva ou de alavancagem operacional para governança e tomadas de decisão pela IA ou pelo usuário.
*   **[Subjetivo]**: Memória humana ou de máquina não estruturada, notas de campo, impressões ou sínteses textuais abertas.
*   **[Rastreabilidade]**: Assinatura técnica temporal ou de origem garantindo a trilha de auditoria atômica do tráfego.
*   **[Governança]**: Variável ou array encarregado de travar barreiras de chancelamento (Approval) ou acionar alarmes de desobstrução de loops.

---

## 1. Pessoas (`pulso_people`)

Nós nevrálgicos de capital social, conectividade, alavancagem comercial e contexto do ecossistema.

### Esquema de Campos Canônicos (24 Vetores Mapeados)

#### A. Identificação e Base
1.  `id` **[Obrigatório]**: Identificador único canônico da entidade (ex: `person_177868_abc`).
2.  `name` **[Obrigatório]**: Nome completo ou designação de identificação direta.
3.  `profession` (ou `role`) **[Opcional]**: Atividade principal ou título funcional.
4.  `company` (ou `organization`) **[Opcional]**: Entidade jurídica ou ecossistema institucional de ancoragem.

#### B. Comunicação e Endereçamento
5.  `contactMethods.whatsapp` **[Obrigatório para Lótus]**: Chave primária de disparo e interface com o agente autônomo via canais de mensagens.
6.  `contactMethods.phone` **[Opcional]**: Linha direta secundária.
7.  `contactMethods.email` **[Opcional]**: Correio eletrônico formal.
8.  `contactMethods.instagram` **[Opcional]**: Vetor social visual.
9.  `contactMethods.linkedin` **[Opcional]**: Vetor social profissional corporativo.
10. `location.city` e `location.country` **[Opcional]**: Ancoragem geográfica para cruzamento de contexto físico e fuso horário.

#### C. Tipificação e Força Relacional
11. `relationType` **[Obrigatório]**: Natureza formal do laço (ex: `partner`, `client`, `team`, `friend`, `provider`, `mentor`).
12. `relationshipLevel` **[Estratégico]**: Grau de profundidade ou maturidade de acesso e confiança.
13. `bondStrength` **[Estratégico]**: Índice de coesão ou força do vínculo (ex: `strong`, `stable`, `fragile`, `dormant`).

#### D. Oportunidade e Expansão
14. `potentialClient` **[Estratégico]**: Sinalizador *Boolean* ou de nível indicando potencial de conversão de negócios diretos.
15. `potentialPartner` **[Estratégico]**: Sinalizador de alavancagem para joint-ventures, co-criações ou distribuição conjunta.
16. `skillsIdentified` **[Estratégico]**: *Array* de *strings* mapeando competências raras ou capacidades técnicas passíveis de consulta futura pelo Fê.

#### E. Histórico e Rastreabilidade
17. `projectRefs` **[Rastreabilidade]**: *Array* de referências canônicas apontando para quais Projetos do PULSO o *stakeholder* possui interface ativa ou concluída.
18. `interactionHistory` **[Subjetivo]**: Trilha auditável ou *array* de objetos narrando os últimos marcos ou encontros significativos.
19. `lastContactAt` **[Rastreabilidade]**: Carimbo estrito contendo a data e hora da última comunicação bidirecional bem-sucedida.

#### F. Governança e Recorrência de Relacionamento
20. `nextContactAt` **[Governança]**: Alarme estrito indicando a data limite ideal para o próximo ponto de toque, servindo de insumo para a Lótus agendar sugestões.
21. `followUpCadence` **[Governança]**: Periodicidade ideal pré-configurada para o laço (ex: `weekly`, `monthly`, `quarterly`, `semiannual`).
22. `relationshipAlerts` **[Governança]**: *Array* de sinalizadores sobre fricções, esfriamento de laço ou alertas de risco comportamental.
23. `pendingPromises` (ou `openLoops`) **[Governança]**: Acordos ou entregas combinadas pendentes de chancelamento ou cumprimento.

#### G. Enriquecimento Livre e Canal
24. `primaryContactChannel` **[Opcional]**: Opção predileta e mais responsiva do nó (ex: `whatsapp`, `call`, `instagram_dm`, `email`).
25. `subjectiveNotes` **[Subjetivo]**: Contexto sensível humano, preferências, *hobbies*, restrições ou peculiaridades documentadas.

### Impactos de Interface e Barramento (Entidade Pessoas)
*   **Impacto na UI**: O formulário de detalhes em `EntityDetailDrawer.tsx` (ou nas visualizações de Pessoas) ganha abas ou seções retráteis agrupadas por cor (Relação, Governança, Oportunidade e Contato), permitindo edição ágil e legibilidade superior sem poluição.
*   **Impacto na Requests Bridge**: O `requestType` canônico `register_person` ou `update_person` precisa aceitar a injeção parcial desses sub-objetos no `payload` sem validação restritiva em tempo de *hook*, assegurando a absorção em tempo real e encaminhando *missingFields* se o nome ou a chave do canal de contato estiverem nulos.
*   **Impacto na Lótus/OpenClaw**: A IA não precisa extrair simultaneamente todos os 24 campos em um único *audio-prompt*. Ela opera de forma cumulativa, enviando atualizações isoladas à medida que novas nuances emergem nas interações do Fê.

---

## 2. Fontes (`pulso_sources`)

Conectores estruturais com a memória externa descentralizada.
*   `id` / `name` / `type` / `system` **[Obrigatório]**: Identificação atômica e destino (ex: `google_sheets`, `notion`).
*   `relevance` **[Obrigatório]**: Peso no carregamento contextual.
*   `syncMode` **[Obrigatório]**: `manual` ou `auto`.
*   `url` **[Opcional]**: Link de visualização canônica.
*   `accessNotes` **[Subjetivo]**: Chaves, *tokens* ou observações de acesso.
*   `lastSyncAt` **[Rastreabilidade]**: Registro do último descarregamento íntegro.
*   **Impacto**: O painel visual mapeia o estado da sincronia e isola *timeouts* da nuvem. A Lótus consome como vetor prioritário para elaboração de respostas.

---

## 3. Projetos (`pulso_projects`)

Onde as intenções ganham prazos, responsáveis e critérios de sucesso mensuráveis.
*   `id` / `name` / `status` / `stage` / `priority` / `areaRef` **[Obrigatório]**: O esqueleto imutável do projeto.
*   `objective` **[Opcional]**: Intenção ou macro-meta.
*   `nextStep` **[Estratégico]**: A próxima ação imediata física capaz de mover o ponteiro (desobstrução direta).
*   `riskSummary` **[Estratégico]**: Síntese de entraves técnicos, humanos ou financeiros.
*   `successCriteria` **[Estratégico]**: A definição exata de *"done"* (quando comemoramos).
*   `deadline` / `startedAt` / `completedAt` **[Rastreabilidade]**
*   **Impacto**: Mapeado na UI com cartões de progresso em grade. O dispatcher da Bridge pode criar tarefas (`create_task`) que se auto-vinculam ao projeto correspondente se a Área bater com o contexto.

---

## 4. Tarefas (`pulso_tasks`)

A menor unidade atômica de execução operacional.
*   `id` / `title` / `status` / `priority` / `ownerRefs` **[Obrigatório]**: Identificação, estado e os CPFs responsáveis pela entrega.
*   `areaRef` / `projectRef` **[Opcional]**: Vínculos hierárquicos.
*   `description` **[Subjetivo]**: Escopo ou notas de execução.
*   `dueDate` **[Opcional]**: Prazo final ou janela ideal.
*   `blockedBy` / `blockReason` **[Estratégico]**: Array ou objeto sinalizando dependências críticas travadas.
*   `originTrail` **[Rastreabilidade]**: Assinatura técnica contendo o `requestId` da Bridge que instanciou a tarefa, canal e *source*.
*   **Impacto**: Componentização central na aba "Tarefas". Se uma tarefa chega com *ownerRefs* que não são o Fê, ela ganha um *badge* de delegação para facilitar o acompanhamento.

---

## 5. Decisões (`pulso_decisions`)

A memória imutável dos cortes estratégicos.
*   `id` / `title` / `decision` / `takenByRefs` **[Obrigatório]**: O enunciado da escolha e quem a assinou.
*   `context` **[Subjetivo]**: O cenário ou dilema que exigiu o veredito.
*   `impactSummary` **[Estratégico]**: Consequências ou desdobramentos operacionais inevitáveis.
*   `createdAt` **[Rastreabilidade]**
*   **Impacto**: O Cockpit exibe o feed de decisões como uma "trilha de sabedoria" e insumo para o modelo de IA evitar a reabertura ou rediscussão de tópicos já deliberados.

---

## 6. Alertas (`pulso_alerts`)

Sinais vitais e de risco iminente exigindo contenção.
*   `id` / `title` / `severity` / `status` **[Obrigatório]**: Nível de gravidade (`critical`, `high`, `medium`, `low`) e estado do ciclo (`active`, `acknowledged`, `resolved`).
*   `description` **[Opcional]**: Causa-raiz ou sintoma.
*   `recommendedAction` **[Estratégico]**: O caminho mais rápido e seguro de mitigação sugerido pela IA ou sensor.
*   `resolvedAt` **[Rastreabilidade]**
*   **Impacto**: Ocupam o topo visual do *Health Center* e do *Cockpit Header* em vermelho pulsante ou ânbar de acordo com a severidade. A Lótus pode disparar sugestões proativas de contenção.

---

## 7. Áreas (`pulso_areas`)

O telhado estrutural e os pilares de longo prazo.
*   `id` / `name` / `type` / `importance` / `status` **[Obrigatório]**: O pilar de sustentação (ex: `business`, `personal`, `health`).
*   `ownerRef` **[Estratégico]**: Guardião da vertical.
*   `governancePolicy` **[Governança]**: Regras canônicas determinando se a injeção de novas frentes de custo nesta Área passa compulsoriamente pelo funil de `needs_approval`.
*   **Impacto**: Filtro base de todas as abas. Garante isolamento entre as verticais da vida pessoal e os braços comerciais da operação corporativa.

---

## 8. Agentes (`pulso_agents`)

Identidades e *skills* autônomas que rodam na infraestrutura.
*   `id` / `name` / `role` / `status` / `autonomyLevel` **[Obrigatório]**: O raio de ação da IA.
*   `requiresApproval` **[Governança]**: Sinalizador mestre ativando a barreira humana em caso de saídas destrutivas.
*   `lastActivityAt` **[Rastreabilidade]**
*   **Impacto**: Exibidos no painel do Ecossistema como cartões de servidores virtuais.

---

## 9. Rotinas (`pulso_routines`)

Loops periódicos automatizados.
*   `id` / `name` / `frequency` / `status` / `tool` **[Obrigatório]**: O motor cíclico.
*   `lastRunAt` / `nextRunAt` **[Rastreabilidade]**
*   `outputExpected` **[Estratégico]**: O artefato ou log de saída esperado ao fim da execução.
*   **Impacto**: Permite o monitoramento visual de saúde para garantir que integrações críticas (como extrações do Sheets ou envios de *follow-up*) rodem conforme o agendamento.
