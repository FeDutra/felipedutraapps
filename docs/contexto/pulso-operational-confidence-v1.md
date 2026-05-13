# PULSO v1.0: Matriz de Confiança Operacional e Roadmap de Transição

Este documento audita e estabelece a **Confiança Operacional** da infraestrutura pré-v1.0 do Cockpit PULSO, confrontando o código interno com as capacidades reais de execução externa da Lótus/OpenClaw.

---

## 1. Tabela de Confiança Operacional

| Funcionalidade | Backend | OpenClaw Opera? | Aparece na UI? | Confiável Uso Diário? | Evidência Canônica | Pendência de Contrato | Próximo Teste Necessário |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Criação de Pessoas** | Sim (`requests.ts`) | Sim (`register_person`) | Sim | 🟢 **Sim** | Gravado direto em `pulso_people` e listado no Ecossistema | Nenhuma | Ciclo autônomo via cURL/OpenClaw |
| **Manutenção de Pessoas** | Sim | Sim (`update/archive`) | Sim | 🟢 **Sim** | Update atômico via `patch` e purga lógica ativada | Falta endpoint atômico de `unarchive` | Validar injeção de novos metadados |
| **Criação de Fontes** | Sim | Sim (`register_source`) | Sim | 🟢 **Sim** | Gravado em `pulso_sources` com modo de sincronia manual | Nenhuma | Testar vínculo na criação |
| **Manutenção de Fontes** | Sim | Sim (`update/archive`) | Sim | 🟢 **Sim** | Modificações aplicadas instantaneamente no Firestore | Falta `unarchive_source` | Link/Unlink cruzado via bridge |
| **Criação de Tarefas** | Sim | Sim (`create_task`) | Sim | 🟢 **Sim** | Rota `/pulso/tarefas` madura com contadores e drawers | Nenhuma | Ingestão com array sanitizado de donos |
| **Manutenção de Tarefas** | Sim | Sim (`update/complete`) | Sim | 🟢 **Sim** | Drawer atualiza status e injeta `completedAt` nativamente | Falta `reopen_task` dedicado | Testar arquivamento de tarefa concluída |
| **Criação de Projetos** | Sim | Sim (`create_project`) | Sim | 🟢 **Sim** | Card renderizado de imediato contendo frentes | Ancoragem de Área exigida | Testar rejeição se área não existir |
| **Manutenção de Projetos** | Sim | Sim (`update/status`) | Sim | 🟢 **Sim** | Mapeamento no switch atualiza chaves e prioridades | Faltam `reopen` e `complete` dedicados | Injeção de `nextStep` via *patch* |
| **Criação de Áreas** | Sim | Sim (`create_area`) | Sim | 🟢 **Sim** | Interceptado com barreira de segurança se `trusted !== true` | UI de aprovação com um clique | Testar fluxo suspensivo em `needs_approval` |
| **Decisões e Alertas** | Sim | Sim (Criação apenas) | Sim | 🟡 **Parcial** | Cadastros gravam nativamente e aparecem nos drawers | Faltam rotas de update/archive na bridge externa | Teste de purga ou encerramento de alerta |
| **Governança de Agentes** | Sim | Não (Bloqueado) | Sim | 🟡 **Parcial** | Pedido suspenso em `needs_approval` protegendo o ÉDEN | Falta a rota REST de ativação de blueprint | Validar rastro visual do pedido de agente |
| **Rotinas Sistêmicas** | Sim (Serviço) | Não | Sim | 🔴 **Não** | Renderizadas na tela de Metabolismo via leitura estrita | Ausentes totalmente da Requests Bridge | Nenhum (bloqueado na ponte) |

---

## 2. Auditoria de Seções Críticas

### Solicitações e Fila de Intenções
A infraestrutura de solicitações atua de forma duplamente ancorada: como filtro nativo de status (`'requests'`) no Inbox Universal e como central de diagnóstico avançada em `/pulso/debug/requests`. É altamente resiliente a exceções de *parsing* de data via funções locais `try/catch`. O retorno do *Dispatcher* espelha na UI os caminhos finais canônicos (`result.entityRef` e `result.entityPath`), além de destacar chaves faltantes (`missingFields`) em *chips* amarelos de atenção.

### Aprovações Práticas (`needs_approval`)
A governança de segurança intercepta perfeitamente requisições sensíveis (como `create_agent` ou `create_area` sem chancela de confiança), estacionando a intenção. A pendência reside na camada visual: falta o painel prático centralizado em que o usuário aplique a aprovação com um único clique (ou via resposta rápida no WhatsApp) acionando a materialização final sem burocracia.

### Arquivamento e Escondimento de Testes
O *soft delete* (`archived: true`) opera de maneira impecável para as entidades principais. Para a fila de solicitações, a UI implementa o botão *"Arquivar Solicitação (Esconder Teste)"*, permitindo que execuções de teste ou requisições de auditoria técnica sejam ocultadas da visão operacional de trabalho diário sem que se perca o rastro do log no banco.

### Reabertura e Desarquivamento
Atualmente supridos no cliente de forma genérica enviando instruções de *patch* via endpoints de `update_*` (reinjetando `status: 'new'` ou `archived: false`). Para atingir o grau de maturidade de um cockpit v1.0, o contrato exige a criação de *requestTypes* atômicos dedicados (como `unarchive_person`, `reopen_task`).

### Tasks (Maturidade Operacional)
A vertical de tarefas atingiu o estado da arte. A coleção `pulso_tasks` é consumida em tempo real pela UI dedicada e referenciada de forma cruzada nos Drawers do Ecossistema (Área e Projeto). A Cloud Function executa purga profunda de chaves indefinidas para assegurar que os metadados de `ownerRefs` sejam populados e higienizados.

### Mobile (Estabilidade de Viewport)
O aplicativo não apresenta quebras ou *crashes* de renderização. O menu principal evita quebras de linha transmutando-se em uma barra horizontal rolável limpa. Contudo, o documento de retrato aponta para a necessidade de lapidação fina de CSS (`body` estrito sem *overflow-x* oculto, e botões expansíveis contidos dentro das margens de segurança).

### Dados de Teste
A diretriz de preservação de memória proíbe deleções físicas no banco. Testes de integração Lótus/OpenClaw utilizam prefixos na chave de deduplicação ou *strings* identificáveis, permitindo que a UI aplique filtros de exclusão automáticos e mantenha a base limpa para uso diário.

### Barramento de Eventos vs Entidade Canônica
A **Regra de Ouro do Barramento** (Seção 4.2 do Retrato) encontra-se validada conceitualmente: operações triviais de cadastro ou microajustes gravam de forma direta e silenciosa nas coleções de destino sem poluir a fila de `pulso_events`. O barramento é estritamente reservado para transições críticas de estado, emissão de alertas ou decisões de alto impacto.

---

## 3. Recomendações Objetivas de Roadmap

### A. O que JÁ pode ser considerado v0.9 (Pronto e Congelado)
*   A infraestrutura REST e os mecanismos de segurança HTTP da Requests Bridge (`/create`, `/pending`, `/claim`, `/complete`, `/fail`, `/needs-clarification`, `/needs-approval`).
*   A página principal e os fluxos de interface visual de **Tarefas** (`/pulso/tarefas`).
*   O carregamento cruzado e a renderização de frentes, fontes, pessoas e tarefas materializadas dentro dos Drawers do **Ecossistema** (`EntityDetailDrawer`).
*   Os fluxos autônomos de criação, alteração e purga lógica de Pessoas, Fontes e Projetos contidos.

### B. O que FALTA para v1.0 (Próximo Bloco de Implementação)
*   Sincronizar e saturar o *switch* da Cloud Function `requests.ts` para suportar os comandos atômicos de reabertura, desarquivamento e desvínculos explícitos.
*   Implementar a interface visual simplificada de **Aprovações Práticas** na UI, permitindo o despacho de itens suspensos em `needs_approval` com um clique.
*   Enriquecer o *schema* do Firestore com as propriedades mínimas unificadas da v1.0 (dados estendidos de contato, acompanhamento e matrizes de rede para stakeholders).
*   Garantir a estabilização absoluta de bordas e *scrolls* horizontais da interface Mobile.

### C. O que deve ESPERAR a v1.5 (Operação Expandida)
*   O piloto operacional completo do **Financeiro Casa** (mantendo a flexibilidade das Google Sheets canônicas sob a orquestração de leitura da Lótus).
*   A interface REST e a automação de *CRUD* avançado para a gestão externa de **Rotinas Sistêmicas** e automações de recorrência.
*   Geração nativa de relatórios executivos consolidados e métricas avançadas de *metabolismo* de agentes.

### D. O que deve ESPERAR a v2.0 (Camada de Voz)
*   A injeção de *transcribers* e conectores de áudio/voz de ponta a ponta. A voz atuará exclusivamente como acelerador natural de *input* e *output* sobre uma arquitetura transacional de requests e aprovações perfeitamente madura e despoluída.
