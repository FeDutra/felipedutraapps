const fs = require('node:fs');
const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { verifyFirebaseIdToken } = require('./firebaseTokenVerifier');

async function createOwnerIdToken() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const webApiKey = process.env.FIREBASE_WEB_API_KEY;
  const ownerEmail = process.env.PULSO_OWNER_EMAIL || 'felipemachadodutra@gmail.com';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'felipedutraapps';
  if (!serviceAccountPath || !webApiKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH e FIREBASE_WEB_API_KEY são obrigatórios.');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ credential: cert(serviceAccount), projectId });
  const auth = getAuth(app);
  const user = await auth.getUserByEmail(ownerEmail);
  const customToken = await auth.createCustomToken(user.uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(webApiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!response.ok) throw new Error(`Firebase token exchange failed (${response.status})`);
  const data = await response.json();
  const payload = await verifyFirebaseIdToken(data.idToken, { projectId, allowedEmail: ownerEmail });
  return { idToken: data.idToken, payload, ownerEmail, projectId };
}

async function main() {
  const { payload, ownerEmail, projectId } = await createOwnerIdToken();
  console.log(JSON.stringify({
    ok: true,
    projectId,
    emailMatches: payload.email === ownerEmail,
    expiresInSeconds: payload.exp - Math.floor(Date.now() / 1000),
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { createOwnerIdToken };
