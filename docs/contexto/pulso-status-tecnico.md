# Status Técnico: Projeto PULSO

## 📊 Estado Atual
- **Frontend**: Etapas 1, 2 e 3 implementadas com sucesso.
- **Lógica**: Orquestração via services e helpers concluída.
- **Dados**: Operando 100% com dados mockados (Seed).
- **Estética**: Dark Premium com Framer Motion.

## 🚀 Etapas Implementadas
1. **Fundação**: Definição de ontologia (types), mocks detalhados e helpers de relacionamento.
2. **Dashboard**: Cockpit estratégico com State Radar, Cards de Estado e Listas de Sinais/Movimentos.
3. **Inbox Universal**: Sistema de captura, triagem e conversão de entidades (Task, Decision, Note, Meeting, Potential Project).

## 🛣️ Rotas Existentes
- `/pulso`: Dashboard principal (Cockpit).
- `/pulso/inbox`: Central de captura e triagem.

## 🧩 Componentes Principais
- `PulseRadar`: Visualização radial de estados do ecossistema.
- `InboxDetailDrawer`: Interface lateral para triagem e conversão.
- `StateCard` / `AreaPulseCard`: Cards de monitoramento em tempo real.
- `InboxFilters` / `InboxItemCard`: Gestão de itens de entrada.

## ⚙️ Services & Types
- `pulsoService.ts`: Centraliza acesso a dados de áreas, projetos, tarefas e inbox.
- `pulso.types.ts`: Define a ontologia ÉDEN (Status, Priority, InboxType, etc).
- `inboxHelpers.ts`: Filtros, buscas e estatísticas do Inbox.

## 🧪 Estrutura de Seed/Mock
- Localizada em `src/apps/pulso/mocks/pulsoSeed.ts`.
- Contém dados realistas para simular o ecossistema antes da integração.

## 🛠️ Pendências Técnicas
- [ ] Implementar persistência real no Firestore (Stage 4).
- [ ] Sincronizar criação de itens no Inbox com o banco de dados.
- [ ] Corrigir pequenos avisos de hidratação e Recharts (Stage 3.5).
- [ ] Preencher documentação detalhada de contexto em `docs/contexto/`.

## ⚠️ Riscos antes da Integração Real
- Complexidade na migração de IDs mockados para IDs do Firestore.
- Necessidade de garantir atomicidade nas operações de conversão (ex: converter inbox para task + atualizar status do inbox).
- Possíveis conflitos de tipos entre o que o Firebase retorna e a ontologia atual.

## 📅 Próximo Passo Recomendado
- **Stage 4: Integração Real**: Começar pela configuração do Firestore e salvar novos itens do Inbox no banco.
