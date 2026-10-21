# PULSO Core v0.9 — identidade soberana e migração do legado

## Estado do marco

Este corte torna explícita a fronteira que antes estava ambígua:

- a PULSO é dona da identidade da Lótus, das áreas, sessões, mensagens, eventos e memória;
- providers são motores substituíveis de inferência;
- OpenClaw/OpenCloud não integra o bundle do Core, nem como fallback, fixture ou adapter;
- o aplicativo legado pode continuar existindo durante a transição, mas não participa do caminho soberano.

## Identidade da Lótus

A identidade é composta por duas camadas:

1. **identidade pública versionada**, distribuída com o Core;
2. **overlay privado local**, instalado no diretório de dados do dispositivo, fora do Git.

O overlay privado contém somente contexto humano necessário à continuidade. Não contém credenciais, tokens ou cópia bruta da memória pessoal. Sua instalação é atômica, com permissão `0600`, versão e digest SHA-256.

Em cada turno, o Core compõe:

1. identidade pública;
2. overlay privado local;
3. sessão atual;
4. memória recuperada com proveniência;
5. histórico da conversa.

O provider recebe contexto para inferência, mas não se torna dono da identidade ou do histórico.

## Migração do legado

O extrator do Firebase permanece fora do Core e opera somente em leitura. Ele produz um snapshot normalizado com proveniência por entidade.

Fluxo:

1. exportação read-only;
2. validação e hash do snapshot;
3. plano sem escrita;
4. backup do SQLite;
5. importação `áreas → sessões → mensagens`;
6. verificação de integridade;
7. segunda aplicação obrigatoriamente idempotente.

Antes de tocar o banco ativo, a migração é materializada em um banco staged no
mesmo volume. A promoção exige hash do snapshot, hash do SQLite, Preview
encerrada sem arquivos WAL/SHM e cria backup recuperável antes da troca
atômica do arquivo principal.

Snapshot auditado em 21/10/2026:

- 21 áreas;
- 162 sessões;
- 24.549 mensagens;
- 24.732 eventos após importação;
- segunda aplicação: zero eventos adicionais;
- integridade SQLite: aprovada.

Os 1.317 pedidos não convertidos foram classificados como envelopes operacionais, testes, canárias, mensagens vazias ou referências a sessões não conversacionais. Nenhum conteúdo privado do snapshot entra no Git.

## Limite honesto

O **Core v0.9** está sem vestígio de OpenClaw/OpenCloud. A casca ampla da PULSO ainda possui módulos legados de voz, ferramentas e operação que serão migrados por capacidade. A presença desses módulos fora de `vendor/pulso-core` não muda a propriedade do caminho conversacional soberano, mas impede declarar o produto inteiro como livre do legado nesta etapa.

Providers locais usam timeout total de streaming de 120 segundos por padrão; APIs externas preservam 15 segundos. A distinção nasceu de prova real no iMac: o endpoint local estava saudável e entregava o primeiro byte rapidamente, mas o raciocínio completo com Soul, contexto privado e sessão ultrapassava uma política originalmente calibrada para APIs remotas.

## Critérios antes de promoção ao iMac

- gate zero-vestígio do Core;
- suíte integral do Core;
- suíte Alpha da casca;
- build web;
- compilação Rust/Tauri;
- bundle Intel rastreável;
- importação ensaiada em banco descartável;
- backup e reversão comprováveis;
- nenhuma mudança em credenciais ou Firebase durante a promoção.
