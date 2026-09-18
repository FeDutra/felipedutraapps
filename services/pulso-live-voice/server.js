const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ACCESS_TOKEN = process.env.PULSO_LIVE_VOICE_TOKEN;
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

  if (!ACCESS_TOKEN || token !== ACCESS_TOKEN) {
    console.warn('[RELAY] rejected connection: invalid token');
    clientWs.close(1008, 'Invalid token');
    return;
  }

  if (!GEMINI_API_KEY) {
    console.error('[RELAY] GEMINI_API_KEY not configured');
    clientWs.close(1011, 'Server misconfigured');
    return;
  }

  console.log('[RELAY] client connected');

  const upstream = new WebSocket(`${GEMINI_WS_BASE}?key=${GEMINI_API_KEY}`);
  let upstreamOpen = false;
  const queue = [];

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

  clientWs.on('message', (data) => {
    if (upstreamOpen) upstream.send(data);
    else queue.push(data);
  });

  clientWs.on('close', (code, reason) => {
    console.log('[RELAY] client closed', code, reason.toString());
    upstream.close();
  });

  clientWs.on('error', (err) => {
    console.error('[RELAY] client error', err.message);
    upstream.close();
  });
});

server.listen(PORT, () => {
  console.log(`[RELAY] listening on ${PORT}`);
});
