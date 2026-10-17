const { WebSocket } = require('ws');
const { createOwnerIdToken } = require('./firebaseAuthCanary');

async function main() {
  const relayUrl = process.env.RELAY_URL;
  if (!relayUrl) throw new Error('RELAY_URL é obrigatória.');
  const { idToken } = await createOwnerIdToken();
  const startedAt = Date.now();
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const evidence = await new Promise((resolve, reject) => {
    const requestId = `canary_${Date.now()}`;
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => finish(new Error('quick-read canary timeout')), 10_000);
    let finished = false;

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (ws.readyState < WebSocket.CLOSING) ws.close(1000, 'quick-read canary complete');
      if (error) reject(error);
      else resolve(result);
    };

    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.authRequired) {
        ws.send(JSON.stringify({ auth: { firebaseIdToken: idToken } }));
        return;
      }
      if (message.authError) {
        finish(new Error('relay rejected Firebase session'));
        return;
      }
      if (message.authComplete) {
        ws.send(JSON.stringify({
          quickRead: {
            requestId,
            capability: 'calendar_today',
            args: { localDate, timezone: 'America/Sao_Paulo' },
          },
        }));
        return;
      }
      if (message.quickReadResult?.requestId !== requestId) return;
      const result = message.quickReadResult;
      if (!result.ok || typeof result.responseText !== 'string') {
        finish(new Error(`quick-read failed: ${result.errorCode || 'unknown'}`));
        return;
      }
      finish(null, {
        ok: true,
        elapsedMs: Date.now() - startedAt,
        connectorDurationMs: result.durationMs,
        itemCount: result.itemCount,
        responseChars: result.responseText.length,
      });
    });
    ws.on('error', error => finish(error));
    ws.on('close', (code, reason) => {
      if (!finished && code !== 1000) finish(new Error(`relay closed ${code}: ${reason.toString()}`));
    });
  });

  console.log(JSON.stringify(evidence));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
