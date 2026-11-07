# PULSO Browser · prévia pública por link v0.1

- **Rota:** `https://felipedutraapps.web.app/browser/`
- **Estado:** rascunho navegável para revisão; não é lançamento.
- **Fonte canônica:** projeto Open Design `pulso-browser-design-v01`.
- **Hash da entrada canônica:** `810c138ae49eb412e668c0457e0121e83e39b3846020c506b5b1dac0d543aa2a`.
- **Privacidade editorial:** `noindex`, `nofollow` e `noarchive` em meta e cabeçalho HTTP. A URL continua pública para quem possuir o link.
- **Matéria publicada:** `index.html`, `styles.css`, `script.js`, glifos e fontes locais. Metadados internos do Open Design e `spec.md` não foram publicados.

## Adaptação de revisão móvel

A rota preserva a composição autoral de 1440 × 900 e apenas escala a cena integral no celular. Não cria uma segunda composição responsiva nem altera o projeto salvo no Open Design.

## Rollback

1. Reverter o commit desta publicação.
2. Rodar `npm run build` em checkout limpo.
3. Rodar `firebase deploy --only hosting`.
4. Confirmar `404` ou fallback da rota `/browser/` e integridade de `/pulso/live`.
