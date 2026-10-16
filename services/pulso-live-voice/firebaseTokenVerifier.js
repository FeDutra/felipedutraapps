const crypto = require('crypto');

const CERTIFICATES_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = null;
let certificateCacheExpiresAt = 0;

function decodeJsonPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function fetchFirebaseCertificates() {
  const now = Date.now();
  if (certificateCache && certificateCacheExpiresAt > now) return certificateCache;

  const response = await fetch(CERTIFICATES_URL);
  if (!response.ok) throw new Error(`firebase certificates unavailable (${response.status})`);
  const certificates = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  certificateCache = certificates;
  certificateCacheExpiresAt = now + Math.max(60, maxAgeSeconds - 60) * 1000;
  return certificates;
}

async function verifyFirebaseIdToken(token, options = {}) {
  const projectId = options.projectId;
  const allowedEmail = options.allowedEmail;
  if (!projectId) throw new Error('firebase project id missing');
  if (typeof token !== 'string' || token.length > 16384) throw new Error('invalid firebase token');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed firebase token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unsupported firebase token');

  const certificates = options.certificates || await fetchFirebaseCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) throw new Error('unknown firebase signing key');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  if (!verifier.verify(certificate, Buffer.from(encodedSignature, 'base64url'))) {
    throw new Error('invalid firebase signature');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('invalid firebase audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('invalid firebase issuer');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('invalid firebase subject');
  if (allowedEmail && payload.email !== allowedEmail) throw new Error('firebase user not allowed');
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error('expired firebase token');
  if (!payload.iat || payload.iat > nowSeconds + 300) throw new Error('invalid firebase issued-at');
  if (payload.auth_time && payload.auth_time > nowSeconds + 300) throw new Error('invalid firebase auth time');
  return payload;
}

module.exports = { verifyFirebaseIdToken };
