const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { verifyFirebaseIdToken } = require('./firebaseTokenVerifier');

const projectId = 'pulso-canary';

function createToken(overrides = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: 'canary-key', typ: 'JWT' };
  const payload = {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'felipe-canary',
    iat: now - 1,
    exp: now + 300,
    auth_time: now - 1,
    email: 'felipe@example.com',
    ...overrides,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    certificates: { 'canary-key': publicKey.export({ type: 'spki', format: 'pem' }) },
  };
}

test('aceita um Firebase ID token assinado para o projeto correto', async () => {
  const fixture = createToken();
  const payload = await verifyFirebaseIdToken(fixture.token, {
    projectId,
    allowedEmail: 'felipe@example.com',
    certificates: fixture.certificates,
  });
  assert.equal(payload.sub, 'felipe-canary');
});

test('rejeita assinatura, projeto e expiração inválidos', async () => {
  const valid = createToken();
  const other = createToken();
  await assert.rejects(() => verifyFirebaseIdToken(valid.token, {
    projectId,
    certificates: other.certificates,
  }), /signing key|signature/);

  const wrongAudience = createToken({ aud: 'outro-projeto' });
  await assert.rejects(() => verifyFirebaseIdToken(wrongAudience.token, {
    projectId,
    certificates: wrongAudience.certificates,
  }), /audience/);

  const expired = createToken({ exp: Math.floor(Date.now() / 1000) - 1 });
  await assert.rejects(() => verifyFirebaseIdToken(expired.token, {
    projectId,
    certificates: expired.certificates,
  }), /expired/);

  const wrongUser = createToken({ email: 'outra-pessoa@example.com' });
  await assert.rejects(() => verifyFirebaseIdToken(wrongUser.token, {
    projectId,
    allowedEmail: 'felipe@example.com',
    certificates: wrongUser.certificates,
  }), /not allowed/);
});
