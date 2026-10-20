# Contrato de paridade da `/live` — v0.7

**Fonte canônica:** repositório `FeDutra/felipedutraapps`, commit `9add42e76db330db029937f851e4b76f9e1e3274`, instalado no iMac como `/Applications/PULSO.app` 0.1.1.

**Fronteira:** a nova PULSO preserva a superfície humana vigente e substitui progressivamente o motor. Este contrato não autoriza reinterpretar composição, gestos ou linguagem. A antiga `PULSO Core Preview` é laboratório técnico; não é fonte visual.

## Regra-mãe

O frontend vigente é o piso. A integração do Core só é aceita quando não reduz nenhuma capacidade abaixo e quando a comparação ocorre no WebView Tauri real, no mesmo host e dimensão.

| Superfície / gesto | Evidência na fonte | Paridade mínima | Prova de aceite |
|---|---|---|---|
| `/pulso/live` como entrada | `src/app/pulso/live/page.tsx` + `src/apps/pulso/pages/LivePage.tsx` | Abrir diretamente na conversa, não na Central | Inicialização Tauri cai em `/pulso/live`; conversa fica visível |
| Trilho de áreas | `LivePage.tsx`, `SortableAreaItemWrapper` | Ordem, glifo, hover, não lidas, criar/configurar área | Selecionar, reordenar e criar sem perder estado após reinício |
| Sessões por área | `SortableChatItemDesktop` | Clique esquerdo seleciona; clique direito abre ao lado; renomear/arquivar permanecem | Sonda antes → ação → depois → inversão para cada gesto |
| Split conversacional | `splitContextNodes`, `pulso-split-grid`, `SecondaryChatPane` | 2 painéis iguais; 3 colunas iguais; 4 em grade 2×2; máximo 4; foco explícito | Abrir por clique direito, trocar foco, fechar e restaurar layout |
| Orbe Lótus | `lotus-orb-presence`, estados e handlers em `LivePage.tsx`; leis em `globals.css` | Uma única presença; entrada, respiração, escuta, pensamento, espera, resposta, erro; arrastável no split | Estado do runtime altera movimento; posição e escala obedecem modo vigente |
| Compositor | footer central em `LivePage.tsx` | Um compositor compartilhado; Enter envia no desktop; Shift+Enter quebra linha; anexos, áudio, resposta e compromisso | Mensagem persiste no contexto focado; nenhuma duplicação em split |
| MESA | `MesaPanel.tsx` + montagem global em `LivePage.tsx` | Abre à direita; conversa desloca; colapsa; restaura; fecha; edita; copia; baixa; lê | Abrir artefato real e validar cada comando com recibo/efeito |
| Material visual | `globals.css` + classes da `/live` | Campo carmim/tema preto vigente, branco quente, transparência, blur, tipografia e respiros idênticos; sem cards administrativos novos | Capturas lado a lado e inspeção de estilo computado |
| Central/SISTEMA | Nova responsabilidade | Continua acessível, mas nunca substitui `/live` | Entrada humana permanece conversa; Central abre por Configurações |

## Estratégia de implementação

1. A casca canônica `felipedutraapps@9add42e7` permanece como cliente.
2. O PULSO Core entra como sidecar/serviço local substituindo adapters de dados e execução por fronteiras explícitas.
3. Componentes visuais pertencentes à PULSO são portados ou reutilizados diretamente; não são redesenhados em HTML/CSS paralelo.
4. Firestore, OpenClaw e demais legados podem coexistir durante migração, mas nunca governam identidade, sessão ou memória novas.
5. Cada migração troca uma fronteira de dados preservando o componente e a jornada.

## Gate para o próximo build

- [ ] Build parte da casca canônica, não da Preview vanilla.
- [ ] `/live`, áreas, sessões, glifos, orbe, compositor, MESA e split estão presentes.
- [ ] Clique esquerdo/direito e foco do split reproduzem a fonte.
- [ ] MESA reproduz abertura, deslocamento, colapso e retorno.
- [ ] WebView → Tauri → Core → WebView completa uma chamada e renderiza estado.
- [ ] Capturas reais do iMac foram comparadas com a PULSO vigente.
- [ ] PULSO atual não foi sobrescrita; bundle ID de canária é distinto.

## Rejeições duráveis

- Dashboard administrativo como home.
- Paleta semelhante sobre composição diferente.
- Orbe tratada como logotipo ou ornamento.
- MESA reimplementada como modal/card genérico.
- Split reduzido a abas, drawers ou dois painéis assimétricos.
- Aceite baseado apenas em PID, SQLite, janela aberta, build verde ou captura sem conteúdo verificável.
