# PULSO Desktop POC (Tauri/Next.js)

Este documento registra o marco de desenvolvimento, comportamento comprovado, pendências e a infraestrutura de áudio local para a versão Desktop (Tauri) da PULSO.

---

## Marcos da POC

* **PULSO_DESKTOP_DEV_RUNNER_OK = CONFIRMADO**
  * O ambiente de desenvolvimento (Next + Tauri dev loop) roda concorrentemente via `npm run pulso:app:dev`.
* **PULSO_DESKTOP_APP_INTERNAL_OK = CONFIRMADO**
  * O aplicativo nativo compilado executável `PULSO.app` abre diretamente sem terminal, apresenta a tela de login alternativa por E-mail/Senha e permite o acesso operacional ao ecossistema.
* **PULSO_DESKTOP_TEXT_LOOP_OK = PARCIAL / OSCILANTE**
  * O envio de mensagens e sincronização Firestore funcionam de forma nativa e em tempo real, mas o retorno de resposta da Lótus/OpenClaw está oscilando devido a instabilidade e latência no worker.
* **PULSO_TEXT_LATENCY_INCIDENT_OPEN = SIM**
  * Registro de incidente de alta latência aberto para o canal de mensagens da PULSO.
* **PULSO_VOICE_APP_KOKORO_POC = EM EXECUÇÃO**
  * Iniciada a fase de áudio e voz nativa do desktop integrado ao modelo de TTS local Kokoro.

---

## Comprovado vs. Não Comprovado

### Comprovado (OK)
1. **Distribuição Nativa:** `PULSO.app` abre sem terminal e roda de forma isolada com excelente desempenho.
2. **Login por Email/Senha:** A tela de login alternativa para Tauri permite a entrada real no Firebase Auth usando credenciais criadas manualmente no console do Firebase.
3. **Sincronização em Produção:** Mensagens trocadas no `.app` sincronizam instantaneamente com o banco Firestore e a interface Web.
4. **TTS e Voz da Lótus:** O botão `[ ouvir ]` executa a síntese de voz usando o `browser_native` (síntese nativa do macOS) ou o modelo de alta qualidade `kokoro_http`.

### Não Comprovado / Pendências
1. **Estabilidade de Resposta da Lótus:** Auditoria de latência pendente no worker.
2. **Voz/Kokoro e Automação de Áudio:** Refinamento do player e controle automático de fala.
3. **Mapeamento de Sessões:** Estruturação lógica de estado vivo (arquitetura conceitual documentada, mas pendente de persistência de dados).

---

## Como Rodar o Kokoro Localmente no iMac

Para habilitar a voz de alta qualidade (Kokoro) no aplicativo nativo sem depender de serviços em nuvem, execute o servidor local via Docker no iMac:

```bash
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

* **Nota Importante:** Como o aplicativo nativo roda localmente no iMac, a URL de comunicação do Kokoro deve apontar para o localhost do iMac (`http://127.0.0.1:8880/v1/audio/speech`). Isso não afeta ou depende de nenhuma porta ou configuração da VPS de produção.

---

## Configuração do Endpoint de Voz

* O endpoint padrão é: `http://127.0.0.1:8880/v1/audio/speech`
* É possível customizar/sobrescrever o endpoint salvando uma chave no localStorage do app:
  `localStorage.setItem('pulso_tts_kokoro_endpoint', 'http://SEU_IP:PORTA/v1/audio/speech')`
* Se o servidor local estiver offline, o app registrará o log `[PULSO_TTS_KOKORO_UNAVAILABLE_FALLBACK_NATIVE]` e acionará automaticamente a voz nativa do navegador/macOS (`browser_native`).
