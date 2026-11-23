// Gateway consumer: run only through gateway_exec for protected secret injection.
// No bank mutation, Notion financial write, external message or local UI.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {composePlanning}=require('/root/projects/worktrees/pulso-finance-copilot-20261123/functions/lib/openFinance/planning.js');
const {enrichFinanceSnapshot}=require('/root/projects/worktrees/pulso-finance-copilot-20261123/functions/lib/openFinance/classification.js');
import {execFileSync} from 'node:child_process';
import {PluggyReadAdapter} from '/root/projects/worktrees/pulso-open-finance-20261123/src/finance/pluggy-read-adapter.mjs';
import {normalizeNotionPages,composeFinanceSnapshot} from '/root/projects/worktrees/pulso-open-finance-20261123/src/finance/reconciliation-plan.mjs';
const dir='/root/.openclaw/data/finance-canary-20261123';
const api=new PluggyReadAdapter({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET});
const childEnv={...process.env,GOOGLE_APPLICATION_CREDENTIALS:'/root/.openclaw/secrets/firebase-pulso-service-account.json'};delete childEnv.PLUGGY_CLIENT_ID;delete childEnv.PLUGGY_CLIENT_SECRET;
try{
 const item=await api.getItem('8783ed7c-b9a1-4221-b00c-1c04bf0b5632');
 if(item.status!=='UPDATED'||(item.consentExpiresAt&&Date.parse(item.consentExpiresAt)<=Date.now()))throw Error('bank_source_not_ready');
 const accounts=await api.accounts(item.id),transactions=[];
 for(const a of accounts)transactions.push(...await api.transactions(a.id));
 if(accounts.length!==1||accounts[0].id!=='5dc65e99-ce6a-4758-b572-314307e62e18')throw Error('account_mapping_changed');
 const snapshot={item,accounts,transactions,providerPagesComplete:true,collectedAt:new Date().toISOString()};
 const notion=JSON.parse(execFileSync('/usr/bin/ntn',['datasources','query','4205166d-3105-8136-93bf-000b328f727d','--limit','5000','--json'],{encoding:'utf8',env:childEnv,maxBuffer:30*1024*1024,timeout:120000}));
 if(notion.has_more||!Array.isArray(notion.results))throw Error('notion_source_incomplete');
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date());
 const baseProjection=composeFinanceSnapshot({snapshot,notionRows:normalizeNotionPages(notion.results),accountBindings:{'5dc65e99-ce6a-4758-b572-314307e62e18':'3795166d31058070ab57ea4cb0235c1b'},notionComplete:true,month});
 const projection=enrichFinanceSnapshot(baseProjection,snapshot);
 const sourceIds={expenses:'c865166d-3105-8300-b80f-07b34cf877d1',income:'8bc5166d-3105-82fa-bb1d-070a4c7326ca',budget:'dcd5166d-3105-8290-b279-073c3059d528',flow:'cd0c30af-961d-4722-a948-e941c916356b',accounts:'ef25166d-3105-8287-b0d6-079765788bdd',goals:'96c5166d-3105-824c-904c-07a6c3e9be55',debts:'17b5166d-3105-833d-b26c-87a619419e7e'};
 const planningSources={};for(const [key,id] of Object.entries(sourceIds))planningSources[key]=JSON.parse(execFileSync('/usr/bin/ntn',['datasources','query',id,'--limit','5000','--json'],{encoding:'utf8',env:childEnv,maxBuffer:30*1024*1024,timeout:120000}));
 projection.planning=composePlanning(planningSources,month);
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=dir+'/scheduled-projection.json';fs.writeFileSync(file,JSON.stringify(projection),{mode:0o600});fs.chmodSync(file,0o600);
 execFileSync(process.execPath,['/root/projects/worktrees/pulso-finance-copilot-20261123/functions/scripts/publish-finance-projection.cjs',file,'JDkgf8M743bYZXd1wAqlBviD21x2','--apply'],{env:childEnv,stdio:'pipe',timeout:60000});
 const receipt={state:'private_projection_updated',at:new Date().toISOString(),sourceUpdatedAt:item.lastUpdatedAt,transactions:transactions.length,notionRows:notion.results.length,monthDisplayed:projection.transactions.length,classificationSuggestions:true};
 fs.writeFileSync(dir+'/last-sync-receipt.json',JSON.stringify(receipt),{mode:0o600});console.log(JSON.stringify(receipt));
}catch(e){console.error(JSON.stringify({state:'sync_failed_previous_projection_preserved',code:e.code||'source_or_publish_failed'}));process.exitCode=1;}
