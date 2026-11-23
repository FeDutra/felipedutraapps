import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { authorizeUser, OpenFinanceError, PluggyConnectService, validateScope } from './core';

const origins = new Set(['https://felipedutra.com','https://www.felipedutra.com','https://felipedutraapps.web.app','https://felipedutraapps.firebaseapp.com','tauri://localhost','http://tauri.localhost','https://tauri.localhost']);
export const pulsoOpenFinance = onRequest({region:'us-central1',timeoutSeconds:90,secrets:['PLUGGY_CLIENT_ID','PLUGGY_CLIENT_SECRET']},async(req,res)=>{
  res.set('Cache-Control','no-store'); res.set('Vary','Origin');
  const origin=req.headers.origin;
  const local=process.env.FUNCTIONS_EMULATOR==='true' && !!origin && /^http:\/\/localhost:(3000|3001)$/.test(origin);
  if(origin && !origins.has(origin) && !local) {res.status(403).json({error:'origin_not_allowed'});return;}
  if(origin) res.set('Access-Control-Allow-Origin',origin);
  if(req.method==='OPTIONS') {res.set('Access-Control-Allow-Methods','POST, OPTIONS');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.status(204).end();return;}
  if(req.method!=='POST') {res.status(405).json({error:'method_not_allowed'});return;}
  try {
    const bearer=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!bearer) throw new OpenFinanceError('authentication_required',401);
    let user;
    try {user=await getAuth().verifyIdToken(bearer,true);} catch {throw new OpenFinanceError('authentication_required',401);}
    authorizeUser(user.uid,user.firebase?.sign_in_provider==='anonymous',process.env.PULSO_FINANCE_ALLOWED_UIDS);
    const service=new PluggyConnectService({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET});
    const db=getFirestore();
    if(req.path.replace(/\/$/,'').endsWith('/connect-token')) {
      const rateRef=db.collection('private_finance_token_rates').doc(user.uid);
      await db.runTransaction(async tx=>{
        const doc=await tx.get(rateRef); const last=doc.data()?.issuedAt?.toMillis?.() || 0;
        if(Date.now()-last<10000) throw new OpenFinanceError('try_again_shortly',429);
        tx.set(rateRef,{issuedAt:Timestamp.now()});
      });
      res.status(200).json(await service.createToken(user.uid));return;
    }
    if(req.path.replace(/\/$/,'').endsWith('/connections')) {
      const scope=validateScope(req.body?.scope);
      const record=await service.verifyConnection(user.uid,req.body?.itemId,scope);
      const id=createHash('sha256').update(`pluggy:${record.itemId}`).digest('hex');
      // Admin-only root collection: existing workspace-wide client rules cannot expose bank bindings.
      const ref=db.collection('private_finance_connections').doc(id);
      await db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        if(old.exists && (old.data()?.ownerUid!==user.uid || old.data()?.scope!==scope)) throw new OpenFinanceError('connection_binding_conflict',409);
        tx.set(ref,{...record,updatedAt:FieldValue.serverTimestamp()}, {merge:true});
      });
      res.status(200).json({connectionId:id,state:record.state,scope});return;
    }
    throw new OpenFinanceError('not_found',404);
  } catch(error) {
    const known=error instanceof OpenFinanceError;
    res.status(known?error.status:500).json({error:known?error.message:'open_finance_unavailable'});
  }
});
