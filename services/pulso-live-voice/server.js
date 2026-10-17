const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { verifyFirebaseIdToken } = require('./firebaseTokenVerifier');
const { executeQuickRead } = require('./quickReadBroker');

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ACCESS_TOKEN = process.env.PULSO_LIVE_VOICE_TOKEN;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'felipedutraapps';
const PULSO_OWNER_EMAIL = process.env.PULSO_OWNER_EMAIL || 'felipemachadodutra@gmail.com';
const GEMINI_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', (clientWs, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!GEMINI_API_KEY) {
    console.error('[RELAY] GEMINI_API_KEY not configured');
    clientWs.close(1011, 'Server misconfigured');
    return;
  }

  let authenticated = Boolean(ACCESS_TOKEN && token === ACCESS_TOKEN);
  let authenticating = false;
  let upstream = null;
  let upstreamOpen = false;
  let quickReadInFlight = false;
  const queue = [];

  const openUpstream = () => {
    if (upstream) return;
    console.log('[RELAY] authenticated client connected');
    upstream = new WebSocket(`${GEMINI_WS_BASE}?key=${GEMINI_API_KEY}`);

    upstream.on('open', () => {
      upstreamOpen = true;
      console.log('[RELAY] upstream (Gemini) open');
      for (const msg of queue) upstream.send(msg);
      queue.length = 0;
    });

    upstream.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
    });

    upstream.on('close', (code, reason) => {
      console.log('[RELAY] upstream closed', code, reason.toString());
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000, reason.toString().slice(0, 120));
    });

    upstream.on('error', (err) => {
      console.error('[RELAY] upstream error', err.message);
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, 'Upstream error');
    });
  };

  if (authenticated) {
    // Compatibilidade temporária para canárias e rollback do cliente antigo.
    openUpstream();
  } else {
    clientWs.send(JSON.stringify({ authRequired: true }));
  }

  clientWs.on('message', async (data) => {
    if (!authenticated) {
      if (authenticating) return;
      authenticating = true;
      try {
        const message = JSON.parse(data.toString());
        const firebaseIdToken = message?.auth?.firebaseIdToken;
        await verifyFirebaseIdToken(firebaseIdToken, {
          projectId: FIREBASE_PROJECT_ID,
          allowedEmail: PULSO_OWNER_EMAIL,
        });
        authenticated = true;
        if (clientWs.readyState !== WebSocket.OPEN) return;
        clientWs.send(JSON.stringify({ authComplete: true }));
        openUpstream();
      } catch (error) {
        console.warn('[RELAY] rejected connection: invalid Firebase session');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ authError: true }));
          clientWs.close(1008, 'Unauthorized');
        }
      } finally {
        authenticating = false;
      }
      return;
    }

    let message = null;
    try {
      message = JSON.parse(data.toString());
    } catch {}

    if (message?.quickRead) {
      const requestId = String(message.quickRead.requestId || '').slice(0, 120);
      if (!requestId || quickReadInFlight) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            quickReadResult: {
              requestId,
              ok: false,
              errorCode: quickReadInFlight ? 'quick_read_busy' : 'invalid_request',
            },
          }));
        }
        return;
      }

      quickReadInFlight = true;
      try {
        const result = await executeQuickRead(message.quickRead);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ quickReadResult: { requestId, ...result } }));
        }
      } finally {
        quickReadInFlight = false;
      }
      return;
    }

    if (upstreamOpen) upstream.send(data);
    else queue.push(data);
  });

  clientWs.on('close', (code, reason) => {
    console.log('[RELAY] client closed', code, reason.toString());
    if (upstream && upstream.readyState < WebSocket.CLOSING) upstream.close();
  });

  clientWs.on('error', (err) => {
    console.error('[RELAY] client error', err.message);
    if (upstream && upstream.readyState < WebSocket.CLOSING) upstream.close();
  });
});

server.listen(PORT, () => {
  console.log(`[RELAY] listening on ${PORT}`);
});
