<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:pulso-visual-guideline -->
## Manifesto Visual e de Presença (Aplica-se a toda a PULSO)

A PULSO não é um software tradicional de dashboard; ela é um **organismo vivo, fluido e integrado** ao usuário. Qualquer atualização deve seguir este manifesto à risca:

*   **Zero Caixas ou Bordas**: Não use contêineres rígidos, cards delimitados, tabelas com contornos ou mesmo efeitos de "vidro" (glassmorphism da Apple) que criem molduras e limites artificiais.
*   **Camadas Etéreas e Luz**: Prefira textos e ícones flutuantes que interagem com focos sutis de luz, transparências totais e `backdrop-blur` sem fronteiras físicas. As separações são feitas por espaço vazio, escala tipográfica e pulsações.
*   **Minimalismo Extremo**: Apenas o essencial extremo deve ser impresso na tela. Elementos de menor importância visual devem possuir opacidade baixíssima (ex: `opacity-10` ou `text-white/10`) e só ganhar vida sob interação direta ou pulso de contexto.
*   **Estética e Linguagem Ocultista**: A interface deve soar analítica, ritualística e enigmática. Utilize fontes monoespaçadas com espaçamentos amplos (`tracking-[0.2em]`), ícones monolineares finos (`strokeWidth={1.5}` ou `{1}`) e tamanhos diminutos (`10px` a `14px`).
*   **Movimento e Vida**: Elementos não aparecem; eles emergem ou se dissipam como luz/fumaça. Ações ativas devem ter pulsações lentas de brilho e sombras difusas (`drop-shadow` de luz) em vez de contornos ativos ou mudanças de tamanho.
*   **Quebra de Padrão**: Se uma solução de design for parecida com a que o mercado corporativo/tech normalmente adota, ela está errada para a PULSO. Faça de outro jeito.
<!-- END:pulso-visual-guideline -->

<!-- BEGIN:pulso-local-execution-standard -->
## Execução local e Presença (Aplica-se a toda versão da PULSO)

Antes de alterar ou publicar a PULSO, leia
`docs/contexto/pulso-local-execution-standard-v1.md` quando a mudança tocar
desktop, voz, ações locais, WhatsApp, Notion, Antigravity, arquivos ou apps.

Regras invariantes:

* A PULSO é a superfície humana; OpenClaw/Lótus coordena; o iMac é executor
  local opcional. A PULSO deve continuar útil quando o Mac estiver desligado.
* Detecte e prove capacidades em runtime. Nunca presuma que nó, app, sidecar,
  Screen Recording, Accessibility ou Automation estão disponíveis.
* Prefira API, MCP, CLI e arquivos. Mouse e teclado exigem uma janela de uso
  exclusivo anunciada ao Fê e não podem sequestrar a tela silenciosamente.
* Ações mecânicas locais não precisam de modelo; interpretação, decisão e
  crítica continuam no orquestrador. Não mova o cérebro para o Mac apenas para
  economizar tokens.
* Gemini Live é a camada de conversa imediata do modo Presença; OpenClaw é o
  cérebro canônico. Kokoro é TTS do fluxo turn-based e precisa de fallback
  explícito entre sidecar local, Kokoro VPS e voz nativa.
* Toda release desktop valida nó offline/online, permissões reais, sidecars,
  fallback de voz e uma prova local reversível. Registre o que não foi testado.
<!-- END:pulso-local-execution-standard -->
