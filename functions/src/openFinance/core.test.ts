import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUser, PluggyConnectService, validateScope } from './core.ts';
const itemId='12345678-1234-1234-1234-123456789abc';
const response=(data:unknown)=>new Response(JSON.stringify(data),{status:200});
const item={id:itemId,clientUserId:'uid-fe',status:'UPDATED',connector:{id:99,name:'MeuPluggy',sandbox:false}};
function service(overrides:Record<string,unknown>={}) {
 const calls:Array<{url:string; init:RequestInit|undefined}>=[];
 const client=new PluggyConnectService({clientId:'fixture-id',clientSecret:'fixture-secret'},async(url,init)=>{
   const path=String(url); calls.push({url:path,init});
   if(path.endsWith('/auth')) return response({apiKey:'fixture-key'});
   if(path.includes('/connectors?')) return response({results:[item.connector]});
   if(path.endsWith('/connect_token'))return response({accessToken:'fixture-connect-token'});
   return response({...item,...overrides});
 });
 return {client,calls};
}
test('access requires configured user and rejects anonymous sessions',()=>{
 assert.doesNotThrow(()=>authorizeUser('uid-fe',false,'uid-fe'));
 for(const [uid,anonymous,allowed] of [['uid-fe',true,'uid-fe'],['other',false,'uid-fe'],['uid-fe',false,undefined],['',false,'uid-fe']] as const) assert.throws(()=>authorizeUser(uid,anonymous,allowed));
});
test('personal and business are explicit; arbitrary scopes reject',()=>{
 assert.equal(validateScope('personal'),'personal'); assert.equal(validateScope('business'),'business'); assert.throws(()=>validateScope('family'));
});
test('missing and placeholder credentials fail before external calls',async()=>{
 for(const config of [{},{clientId:'client_id',clientSecret:'client_secret'}]) await assert.rejects(new PluggyConnectService(config).createToken('uid-fe'),/not_configured/);
});
test('token options carry authenticated UID nested correctly; only MeuPluggy connector returned',async()=>{
 const {client,calls}=service(); const token=await client.createToken('uid-fe');
 assert.equal(token.connectorId,99); assert.equal(token.expiresInSeconds,1800);
 const sent=JSON.parse(calls.at(-1)!.init!.body as string);
 assert.deepEqual(sent,{options:{clientUserId:'uid-fe',avoidDuplicates:true}});
 assert.ok(calls.every(c=>c.init?.redirect==='error'));
});
test('unavailable personal connector does not fall back to direct bank or sandbox',async()=>{
 for(const connector of [{id:1,name:'Nubank'},{id:99,name:'MeuPluggy',sandbox:true}]) {
 const client=new PluggyConnectService({clientId:'fixture',clientSecret:'fixture'},async url=>String(url).endsWith('/auth')?response({apiKey:'key'}):response({results:[connector]}));
 await assert.rejects(client.createToken('uid-fe'),/connector_unavailable/);
 }
});
test('callback item is fetched server-side and produces metadata only',async()=>{
 const {client,calls}=service(); const record=await client.verifyConnection('uid-fe',itemId,'business');
 assert.equal(record.scope,'business'); assert.equal(record.ownerUid,'uid-fe'); assert.equal(record.state,'connected_awaiting_sync');
 assert.equal('apiKey' in record,false); assert.ok(calls.at(-1)!.url.endsWith(`/items/${itemId}`));
});
test('item belonging to another user or with absent ownership is rejected',async()=>{
 for(const owner of ['other',null,undefined]) {const {client}=service({clientUserId:owner}); await assert.rejects(client.verifyConnection('uid-fe',itemId,'personal'),/owner_not_verified/);}
});
test('invalid callback identifiers cannot become arbitrary API paths',async()=>{
 const {client,calls}=service(); await assert.rejects(client.verifyConnection('uid-fe','../auth','personal'),/invalid_item_id/); assert.equal(calls.length,0);
});
test('wrong id, connector and failed item state reject',async()=>{
 for(const override of [{id:'wrong'},{connector:{name:'Nubank',id:1}},{status:'LOGIN_ERROR'}]) {const {client}=service(override);await assert.rejects(client.verifyConnection('uid-fe',itemId,'personal'));}
});
test('transport and provider errors never echo credentials or personal payloads',async()=>{
 for(const fetchImpl of [async()=>new Response('fixture-secret',{status:401}),async()=>{throw Error('fixture-secret');}]){
 const client=new PluggyConnectService({clientId:'fixture',clientSecret:'fixture-secret'},fetchImpl);
 await assert.rejects(client.createToken('uid-fe'),error=>error instanceof Error && !error.message.includes('fixture-secret'));
 }
});
