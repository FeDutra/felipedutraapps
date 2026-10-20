# PULSO Desktop v0.8 — conversa soberana

Data: 20/10/2026

## Propósito

Este marco substitui, no aplicativo Desktop, o caminho conversacional legado
baseado em `pulso_requests`/Firebase por uma execução pertencente ao PULSO
Core. A casca visual canônica permanece a mesma.

## Fluxo aceito

1. a mensagem humana é persistida no SQLite antes da chamada externa;
2. o Core escolhe o provider configurado;
3. deltas são entregues incrementalmente à interface;
4. cancelamento interrompe a execução sem fallback ou segunda cobrança;
5. a resposta da Lótus, o recibo e o estado terminal são confirmados de forma
   atômica;
6. reinício reconstrói áreas, sessões, mensagens e execuções a partir do Core.

## Autonomia do Desktop

- OpenAI, Anthropic e endpoint local são selecionáveis pela Central interna;
- modelo e endpoint são configuráveis;
- credenciais externas ficam no Keychain do macOS;
- o sidecar recebe a credencial somente em memória;
- segredo não entra em SQLite, `localStorage`, histórico, recibo ou log;
- HOME, MESA, split, orbe, voz e linguagem visual da PULSO são preservados;
- o painel ativo do split recebe uma lâmina luminosa discreta.

## Limites deliberados

- anexos ficam bloqueados no caminho soberano até existir ingestão multimodal
  própria do Core;
- a configuração ao vivo de provider só pode ser validada no aplicativo macOS
  instalado;
- a aplicação web continua usando sua fronteira atual e não é alterada por
  este marco.

## Evidência automatizada

- 24/24 testes da fronteira Desktop/Core;
- build Next de produção concluído;
- `cargo check` concluído com apenas um aviso legado de API depreciada;
- segredo bruto ausente dos recibos e dos logs de build.

## Critério de aceite no MacBook

- abrir pela HOME;
- configurar provider e guardar segredo no Keychain;
- testar conexão sem expor credencial;
- enviar mensagem em uma sessão normal sem criar sessão `SISTEMA`;
- observar streaming, cancelar e retomar;
- abrir split e identificar o painel ativo;
- fechar e reabrir preservando área, sessão e histórico;
- manter `/Applications/PULSO.app` intacta.
