# PULSO
## Metodologia de Documentação Replicável v0.1

Este documento inicia a metodologia de documentação do PULSO para que o processo não fique preso apenas em conversas.

A intenção é permitir que, no futuro, o método seja replicado para outros projetos, clientes, áreas ou produtos.

---

## 1. Princípio

Tudo que for estruturante precisa gerar documentação.

Não basta funcionar.
Precisa ser compreensível, auditável e replicável.

---

## 2. Documentos mínimos por fase

Cada fase relevante deve gerar:

1. Retrato do Momento
2. Contrato Técnico
3. Manual Operacional
4. Histórico de Decisões
5. Checklist de Replicação

---

## 3. Estrutura sugerida no repositório

```txt
docs/
  contexto/
    pulso-retrato-momento-plano-1-0.md
    pulso-metodologia-documentacao-replicavel.md
    pulso-operational-kit.md
    pulso-requests-bridge-contract.md
    pulso-decision-log.md

  setup/
    firebase.md
    firestore.md
    functions.md
    google-sheets.md
    openclaw.md
    env-vars.md

  operacao/
    como-usar-pulso.md
    como-testar-requests.md
    como-aprovar-solicitacoes.md
    como-limpar-testes.md
```

---

## 4. O que precisa ser documentado depois

- como o Firebase foi configurado
- como o Firestore foi estruturado
- como as collections foram nomeadas
- como as rules foram configuradas
- como as Cloud Functions foram criadas
- como a Requests Bridge funciona
- como o token de ingestão é usado
- como o OpenClaw acessa o PULSO
- como os conectores foram feitos
- como as Google Sheets entram como base canônica
- como a Lótus cria requests
- como a Lótus processa requests
- como approvals funcionam
- como needs_clarification funciona
- como dados de teste são arquivados
- como fazer deploy
- como garantir Git limpo
- como replicar para outro workspace

---

## 5. Regra daqui para frente

Toda vez que uma fase fechar, criar:

- um snapshot do estado
- um checklist técnico
- um checklist operacional
- um log de decisões
- um prompt base atualizado para Antigravity
- um prompt base atualizado para Lótus / OpenClaw

---

## 6. Objetivo final

Transformar o PULSO em:

1. ferramenta real de uso pessoal do Fê
2. arquitetura replicável
3. metodologia de construção de cockpits operacionais com IA
4. produto potencial no futuro
