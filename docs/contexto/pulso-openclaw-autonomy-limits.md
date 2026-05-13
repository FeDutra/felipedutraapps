# Matriz de Autonomia e Limites da IA: PULSO v1.0 (Lótus & OpenClaw)

Esta carta de governança operacional estabelece a fronteira de autonomia entre a inteligência artificial autônoma (camadas **Lótus** e **OpenClaw**) e o barramento do estado vivo no **PULSO**, definindo o raio de ação em 6 níveis de escalonamento mestre.

A inobservância dessas barreiras por qualquer *skill* injetado constitui quebra de contrato do barramento.

---

## 1. Mutações Diretas e Imediatas (Sem Barreira)

O modelo de IA possui autorização expressa para efetivar o *bypass* da aprovação e persistir a transação em status `completed` unicamente nas seguintes circunstâncias:

### A. Criação Automática (`create_request` ➔ `completed`)
*   **Tarefas Operacionais Cotidianas**: Instanciar tarefas (`pulso_tasks`) cujos prazos estejam contidos nos próximos 30 dias e que não envolvam desembolso financeiro direto superior ao limite de caixa discricionário.
*   **Decisões Secundárias Concluídas**: Registrar vereditos simples tomados oralmente pelo Fê em reuniões ou *voice-notes* para desobstrução de pautas diárias.
*   **Alertas de Nível Baixo ou Médio**: Levantar *flags* de infraestrutura, lembretes de revisão de *software* ou potenciais fricções de cronograma.
*   **Pessoas (Apenas Contatos Frios/Descoberta)**: Registrar o nó mestre inicial de uma Pessoa recém-citada contendo apenas `name`, `relationType` secundário e `whatsapp` como rascunho de rede.

### B. Atualização Automática (`update_request` ➔ `completed`)
*   **Marcos de Progresso em Tarefas**: Mover *status* de tarefas secundárias entre `new` ➔ `in_progress` ➔ `completed` com base na constatação do envio de artefatos.
*   **Ajuste Fino de Datas e Horários**: Reprogramar a chave `nextContactAt` ou adiar `dueDate` de tarefas não críticas em até 7 dias úteis de acordo com solicitações contextuais expressas.
*   **Enriquecimento de Notas Subjetivas**: Injetar sínteses textuais transientes no array de `interactionHistory` de Pessoas com base em áudios de *debriefing*.

### C. Arquivamento Automático (`archive_request` ➔ `archived`)
*   **Envelopes Transientes ou Duplicados**: Acionar o *soft-delete* para pacotes de serviço cujo `dedupeKey` ou processamento revelem estrita redundância técnica com transações já gravadas no ciclo de 24 horas.
*   **Notificações Lidas**: Limpar alertas já reconhecidos sem impacto durável no histórico de risco da vertical.

---

## 2. Barreira de Aprovação Obrigatória (`needs_approval`)

O processador deve travar compulsoriamente a transação, disparar notificação à UI mestre e aguardar a chancela humana por meio da função `approveRequest` perante qualquer tentativa de:

*   **Criação de Projetos e Investimentos**: Instanciar novos nós em `pulso_projects` ou alocar orçamentos/cronogramas de alto impacto em qualquer Área.
*   **Edição de Chaves Estratégicas em Pessoas**: Promover um *stakeholder* ao nível `potentialPartner: true` ou `potentialClient: true`, ou alterar os índices preditivos de `bondStrength` e `relationshipLevel` para os níveis máximos.
*   **Mutação de Pilares em Áreas**: Alterar a string de identificação raiz ou os responsáveis canônicos (`ownerRef`) de qualquer vertical estratégica da vida ou do negócio.
*   **Encerramento de Nós da Rede**: Mover o status de Pessoas ou Fontes para inatividade ou quarentena sem pedido explícito reiterado.

---

## 3. Barreira de Clarificação Obrigatória (`needs_clarification`)

O envelope da transação é ejetado do fluxo, estacionado e marcado com o array de `missingFields` acompanhado de perguntas de refinamento quando o agente esbarra em:

*   **Omissão de Atributos Nucleares**: Incapacidade de extrair no *payload* a propriedade exigida pelo contrato da Bridge (ex: `requestType: "register_decision"` chegando sem a *string* exata no campo `decision`).
*   **Instruções Ambíguas ou Contraditórias**: Áudios ou comandos transcritos contendo ordens excludentes (ex: *"marque o projeto como cancelado, mas agende uma revisão para amanhã com o cliente"*).
*   **Resoluções de Conflitos de Referência**: Incapacidade de determinar univocamente a qual Pessoa do banco de dados o Fê está se referindo caso existam homônimos ou apelidos partilhados na mesma Área.

---

## 4. Interdições Absolutas de Sistema (O que a IA NUNCA Deve Fazer)

Fica terminantemente vetado no nível de infraestrutura, com bloqueio em nível de regras do Firestore e rejeição de *schema*:

*   **Exclusão Física de Documentos (`DELETE`)**: Eliminar de forma irreversível registros nativos das coleções de produção. O único caminho permitido para supressão de visibilidade é o *soft-delete* (`archived: true`).
*   **Disparo Externo Não Autenticado**: Emitir mensagens ativas ou e-mails em nome do Fê para *stakeholders* reais sem que a transação correspondente passe pelo crivo prévio em duplo fator de um *status* `needs_approval`.
*   **Alteração de Políticas de Governança**: Mudar de forma autônoma as matrizes de permissão ou as configurações mestre de segurança de outros Agentes cadastrados.
