# PULSO · soberania operacional e nova navegação · v0.1

**Data:** 14/10/2026  
**Estado:** primeira fatia ativa em produção; web, regras e ponte comprovadas
**Princípio:** PULSO é a autoridade humana e a experiência. OpenClaw é runtime. Control UI é contingência.

## O corte

A PULSO não deve reproduzir todas as páginas da OpenClaw nem manter um museu das telas que surgiram durante sua formação. Ela deve oferecer as operações que Fe realmente precisa, com linguagem própria, e esconder infraestrutura até que uma decisão humana seja necessária.

Nova hierarquia:

1. **PULSO** — presença e trabalho cotidiano;
2. **COMUNICAÇÃO** — e-mail, conversas públicas, cadastros e aquisição;
3. **SISTEMA** — decisões, estado, integrações, chaves, agentes e observabilidade;
4. **LABORATÓRIO** — rotas experimentais, sem presença na navegação principal.

## Navegação v0.1

| Camada | Entrada | Destino | Estado |
|---|---|---|---|
| PULSO | Lótus | `/pulso/live` | manter |
| PULSO | Tarefas | `/pulso/tarefas` | manter; revisar quando o trabalho espacial existir |
| Comunicação | E-mail | `/pulso/email` | manter |
| Comunicação | Conversas | `/pulso/conversas` | manter |
| Comunicação | Cadastros | `/pulso/downloads` | manter provisoriamente; renomear e unificar leads/downloads |
| Bastidor | Sistema | `/pulso/sistema` | novo núcleo |

## Quarentena das entradas antigas

Nenhuma rota é apagada no primeiro corte. Elas apenas deixam a navegação principal.

| Entrada antiga | Diagnóstico | Destino provável |
|---|---|---|
| Campo Vivo | rota ausente; promessa sem superfície | absorver em PULSO/áreas ou eliminar |
| Ecossistema | rota ausente e conceito amplo | visão dentro de SISTEMA ou HOME |
| Conexões | implementação antiga mistura configuração e segredo no browser | substituir por Integrações em SISTEMA |
| Registro da Lótus | útil como histórico, não como destino principal | busca/histórico da conversa |
| Agentes | rota ausente; taxonomia técnica | Inteligências em SISTEMA |
| Saúde / Riscos | tela existente e útil, porém técnica | Estado em SISTEMA; rota legada preservada |
| Bastidor Técnico | rota ausente | Estado/Logs em SISTEMA |
| Navegador PULSO | superfície suspensa por desempenho | laboratório, nunca navegação padrão |
| Debug / Orbe tests / Orb lab | ferramentas internas | laboratório não navegável |

**Critério de remoção definitiva:** 30 dias sem dependência, função absorvida e rollback documentado.

## Primeiro vertical: decisões

### Fluxo

```text
OpenClaw Gateway
  → evento oficial de aprovação
PULSO Operator Bridge
  → sanitiza e projeta
Firestore / pulso_operator_approvals
  → interface SISTEMA · Decisões
Fe decide
  → intenção restrita por regra
PULSO Operator Bridge
  → approval.resolve
OpenClaw executa ou nega
```

### Fronteiras de segurança

- O browser não recebe token do Gateway.
- O browser não chama `approval.resolve` diretamente.
- Segredos, variáveis de ambiente, tokens e metadados crus não entram no Firestore.
- Apenas a conta proprietária pode ler e registrar uma decisão.
- O cliente só pode mudar `pending → resolving` e somente para uma decisão oferecida pelo Gateway.
- O bridge usa Admin SDK no Firestore e o `approval runtime` local nativo da OpenClaw, limitado a `operator.approvals` e aceito apenas no loopback do Gateway.
- Resolução é first-answer-wins; retorno do Gateway é canônico.
- Control UI permanece como contingência durante a migração.

## SISTEMA: módulos e ordem

### Fase 1 — autoridade

- caixa de aprovações de execução, plugins/MCP e agentes;
- histórico de decisões;
- estado da ponte e do Gateway;
- deep-link de contingência para o Control UI quando necessário.

### Fase 2 — operação

- sessões e agentes ativos;
- modelos, providers, contas e intensidade;
- nós e dispositivos;
- saúde, filas, latência e incidentes;
- rotinas e automações, com dono e reversão explícitos.

### Fase 3 — integrações

- catálogo de integrações por estado, dono, origem e última prova;
- pareamento e OAuth com cerimônia segura;
- políticas MCP por servidor/ferramenta;
- nenhum formulário de segredo em Firestore.

### Fase 4 — cofre e política

- listar referências e estado de segredos;
- criar/substituir/revogar sem revelar valor armazenado;
- permissões temporárias e concessões permanentes visíveis;
- trilha de auditoria e revisão periódica.

## Comunicação e marketing

As superfícies novas não devem ser jogadas no mesmo nível de infraestrutura.

```text
COMUNICAÇÃO
├── E-mail / Correspondência
├── Conversas do site
├── Cadastros e audiência
├── Downloads / conversões
└── Chat e atendimento (quando houver fonte real)
```

Próximo trabalho desta frente:

1. unificar pessoa/cadastro/conversa por identidade;
2. separar entrada, relacionamento e conversão;
3. evitar dashboards independentes para cada canal;
4. adotar uma caixa viva de comunicação com filtros, não cinco menus.

## Provas da primeira fatia

- build web aprovado;
- regras Firestore compiladas e publicadas pelo Firebase;
- browser sem token do Gateway e bridge autenticado pelo runtime local nativo;
- replay das pendências antes de aceitar eventos ao vivo;
- prova ponta a ponta com uma aprovação inofensiva e decisão `deny` devolvida ao Gateway;
- confirmação de que nenhum segredo aparece no documento sanitizado;
- bridge supervisionado com reinício e heartbeat;
- Control UI ainda funcional como rollback.

### Recibo da ativação

- código web e ponte: `ffe79aebd47a3433fb7390e65fd3f7e10201a7d7`;
- rota: `/pulso/sistema`;
- serviço: `pulso-operator-bridge.service`;
- autoridade canônica: `approval.resolve` no Gateway;
- Firestore: projeção sanitizada e intenção humana, nunca fonte da autorização;
- teste de execução: o comando-canário foi negado e não executado.

## O que não fazer

- embutir o Control UI em iframe;
- copiar sua arquitetura visual;
- expor Gateway no browser;
- usar Firestore como fonte canônica de aprovação;
- guardar segredos ou service accounts no cliente;
- migrar todos os painéis antes de provar o vertical de decisões;
- manter item de menu apenas porque um dia existiu uma ideia para ele.

## Decisão de produto

O primeiro resultado não é “ter mais um painel”. É Fe conseguir permanecer na PULSO quando a OpenClaw pede autoridade. A migração seguinte acontece por necessidade real: cada vez que Fe precisar sair da PULSO para operar algo recorrente, isso vira candidato a uma nova capacidade soberana — não automaticamente uma nova página.
