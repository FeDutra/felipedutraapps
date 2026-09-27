"use strict";
/**
 * @file templates.ts
 * @description Accessible, minimal, and faithful email templates for PULSO Correspondência.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.buildConfirmationEmail = buildConfirmationEmail;
exports.buildWelcomeEmail = buildWelcomeEmail;
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
/**
 * Common layout envelope faithful to PULSO: dark palette (#0c0c0c), off-white typography,
 * monospace accents, no rigid outer card boundaries, fluid and accessible.
 */
function emailLayout(content, footerLinks) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <title>correspondência · fe</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0c0c;
      color: #edebe8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.7;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      padding: 48px 24px 64px 24px;
    }
    .header {
      font-family: "SF Mono", Monaco, Inconsolata, "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace;
      font-size: 11px;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #9e9a93;
      margin-bottom: 48px;
    }
    .body-text {
      font-size: 15px;
      font-weight: 350;
      color: #edebe8;
      margin-bottom: 28px;
    }
    .body-text p {
      margin: 0 0 20px 0;
    }
    .btn-action {
      display: inline-block;
      margin: 32px 0;
      padding: 14px 28px;
      background-color: #fbf9f5;
      color: #0c0c0c !important;
      text-decoration: none;
      font-family: "SF Mono", Monaco, Inconsolata, monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      border-radius: 2px;
    }
    .alt-link {
      font-family: "SF Mono", Monaco, Inconsolata, monospace;
      font-size: 11px;
      color: #7a7670;
      word-break: break-all;
      margin-top: 12px;
    }
    .alt-link a {
      color: #a8a49d;
      text-decoration: underline;
    }
    .signoff {
      margin-top: 36px;
      font-size: 14px;
      color: #d1ceca;
    }
    .footer {
      margin-top: 64px;
      padding-top: 32px;
      border-top: 1px solid #1f1f1f;
      font-family: "SF Mono", Monaco, Inconsolata, monospace;
      font-size: 10px;
      letter-spacing: 0.15em;
      color: #5a5650;
      line-height: 1.8;
    }
    .footer a {
      color: #7a7670;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      P U L S O &nbsp;·&nbsp; C O R R E S P O N D Ê N C I A
    </div>
    <div class="body-text">
      ${content}
    </div>
    <div class="footer">
      ${footerLinks}
      <div style="margin-top: 16px;">
        fe · felipedutra.com
      </div>
    </div>
  </div>
</body>
</html>`;
}
/**
 * 1. Confirmation Email Template
 */
function buildConfirmationEmail(data) {
    const greeting = data.name ? `Olá, ${escapeHtml(data.name)}.` : "Olá.";
    const confirmUrl = data.confirmUrl || "https://felipedutra.com";
    const content = `
    <p>${greeting}</p>
    <p>
      Você pediu para receber a correspondência de fe.
    </p>
    <div>
      <a href="${escapeHtml(confirmUrl)}" class="btn-action" target="_blank" rel="noopener noreferrer">
        Confirmar Inscrição
      </a>
    </div>
    <div class="alt-link">
      Se o botão não funcionar, use este link:<br>
      <a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a>
    </div>
    <p style="margin-top: 32px; font-size: 13px; color: #8f8b85;">
      O link expira em 48 horas.<br>
      Se não foi você que solicitou, ignore esta mensagem.
    </p>
  `;
    const footer = `
    <span>Inscrição pendente de confirmação.</span>
  `;
    const text = `${data.name ? `Olá, ${data.name}.` : "Olá."}

Você pediu para receber a correspondência de fe.

Para confirmar sua inscrição, use este link:
${confirmUrl}

O link expira em 48 horas.
Se não foi você que solicitou, ignore esta mensagem.

--
fe · felipedutra.com`;
    return {
        subject: "confirme sua inscrição · correspondência",
        html: emailLayout(content, footer),
        text
    };
}
/**
 * 2. Welcome Email Template (Auto-response after confirmation)
 */
function buildWelcomeEmail(data) {
    const greeting = data.name ? `Olá, ${escapeHtml(data.name)}.` : "Olá.";
    const unsubscribeUrl = data.unsubscribeUrl || "https://felipedutra.com/?correspondence=unsubscribed";
    const content = `
    <p>${greeting}</p>
    <p>
      Sua inscrição está confirmada. Quando algo merecer circular, chega por aqui.
    </p>
    <div class="signoff">
      fe
    </div>
  `;
    const footer = `
    <a href="${escapeHtml(unsubscribeUrl)}">Cancelar recebimento</a>
  `;
    const text = `${data.name ? `Olá, ${data.name}.` : "Olá."}

Sua inscrição está confirmada. Quando algo merecer circular, chega por aqui.

fe

--
Para cancelar o recebimento:
${unsubscribeUrl}

fe · felipedutra.com`;
    return {
        subject: "inscrição confirmada · correspondência",
        html: emailLayout(content, footer),
        text
    };
}
//# sourceMappingURL=templates.js.map