<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:pulso-visual-guideline -->
## Regra Visual e de UI (Aplica-se a toda a PULSO)

A PULSO não deve usar boxes pesados como linguagem padrão.

Evitar:
- cards com borda pesada
- caixas cinzas sólidas
- painéis blocados
- UI com cara de dashboard tradicional
- blocos duros
- container visual excessivo

Preferir:
- blur atrás do conteúdo (backdrop-blur)
- glass/vidro/transparência
- camadas etéreas
- texto leve sobre campo
- pouca borda ou nenhuma borda (ring leve)
- divisões por espaço, escala, luz e movimento
- hierarquia tipográfica limpa
- presença visual suave

Quando houver conteúdo flutuante, usar:
- camada com backdrop-blur
- fundo translúcido
- sem box pesado e sólido
- menos contorno e mais respiro

A lógica é: não queremos caixas dentro da PULSO; queremos camadas de presença.
<!-- END:pulso-visual-guideline -->
