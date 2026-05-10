# Política de Emissão: OpenClaw → PULSO v0.1

Este documento estabelece as regras, critérios e protocolos para a emissão de eventos pela camada operacional (**OpenClaw**) para a central de estado (**PULSO**).

## 1. Princípio Central

> [!IMPORTANT]
> **O PULSO recebe mudança de estado, não atividade.**

O objetivo do barramento de ingestão não é registrar logs técnicos de execução (que devem permanecer no OpenClaw), mas sim atualizar a "foto" atual do ecossistema do Fê. Se algo não altera a realidade operacional, a memória de longo prazo ou a lista de prioridades, não deve ser emitido.

## 2. Critérios de Emissão

### ✅ O que deve ser emitido:
- **Criação de Responsabilidade:** Novas tarefas ou compromissos delegados ou assumidos.
- **Mudança de Prioridade:** Alterações no que é crítico ou urgente.
- **Decisão Durável:** Escolhas estratégicas ou operacionais que precisam ser lembradas no futuro.
- **Risco Concreto:** Problemas reais que impactam projetos, finanças ou saúde.
- **Alteração de Entidade:** Criação ou mudança de estado em Área, Projeto, Pessoa, Fonte ou Agente.
- **Memória Consultável:** Informações que serão úteis para consultas futuras pelo Fê ou por outros agentes.
- **Ação Requerida:** Qualquer sinal que exija atenção ou ação imediata do Fê.

### ❌ O que NÃO deve ser emitido:
- **Pensamento Intermediário:** Raciocínios parciais ou brainstorms não concluídos.
- **Conversa Comum:** Interações triviais sem desdobramento operacional.
- **Leitura Bruta:** Conteúdo integral de arquivos, sites ou fontes sem síntese.
- **Log Técnico Saudável:** Confirmações de que "o sistema está rodando normalmente".
- **Testes:** Eventos gerados apenas para validação técnica sem valor de negócio.
- **Repetições:** Informações já enviadas sem alteração de valor.
- **Detalhe Transitório:** Micro-etapas de um processo que não mudam o "status" final do projeto.

---

## 3. Protocolo por Tipo (v0.1)

### 🔹 TASK (Tarefa)
- **Regra:** Se o agente identifica uma nova ação clara ou mudança em prazo/status de tarefa existente.
- **Check:** Exige execução humana ou de outro agente? Se sim, emita.

### 🔹 DECISION (Decisão)
- **Regra:** Se um conflito foi resolvido ou uma direção foi escolhida.
- **Check:** Isso impacta como trabalharemos amanhã? Se sim, emita.

### 🔹 ALERT (Alerta)
- **Regra:** Se algo quebrou ou existe um risco iminente.
- **Check:** O Fê precisa saber disso para não haver prejuízo? Se sim, emita.

### 🔹 PROJECT_UPDATE (Atualização de Projeto)
- **Regra:** Se o projeto mudou de fase (ex: Seed -> Front) ou status (ex: Active -> Paused).
- **Check:** A "foto" do ecossistema mudou? Se sim, emita.

---

## 4. Checklist Pré-Emissão (Obrigatório para Skills/Agentes)

Antes de disparar o `pulso_emit.sh`, o agente deve validar:
1. **Isso muda estado?** (Não é apenas log de atividade).
2. **Qual entidade foi alterada?** (Projeto, Área, Pessoa, etc).
3. **Exige ação, memória ou atenção?**
4. **O tipo correto é Task, Decision, Alert ou Project_Update?**
5. **O destino correto é Direto, Inbox ou Não Emitir?**
6. **Será útil quando o Fê consultar daqui a uma semana?**
7. **Existe risco de ruído?** (Se sim, tente sintetizar mais antes de enviar).

---

## 5. Plano de Teste Manual (48 Horas)

Para validar a política v0.1 em produção:

- **Volume:** Máximo de 5 emissões por dia (Ideal: 2 a 4).
- **Tipos Permitidos:** Apenas `task`, `decision` e `alert`.
- **Restrição:** `project_update` apenas em casos inequívocos de mudança de marco.
- **Critério de Sucesso:** Aprovação de automações futuras apenas se **80% ou mais** dos eventos emitidos manualmente forem considerados "claramente úteis" pelo Fê.

---
**Caminho de referência no OpenClaw:** `/root/.openclaw/workspace/skills/pulso/policy.md`
