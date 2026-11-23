import {OpenFinanceError} from './core';
// Administrative projection only. This never reads a client-supplied document path.
export function readFinanceProjection(record: any, uid: string, now=new Date()) {
 if(!record)throw new OpenFinanceError('snapshot_not_ready',409);
 if(record.ownerUid!==uid)throw new OpenFinanceError('snapshot_owner_mismatch',403);
 const p=record.projection;
 const cents=(v:any)=>{if(!Number.isSafeInteger(v))throw new OpenFinanceError('invalid_snapshot',502);return v;};
 const str=(v:any)=>{if(typeof v!=='string'||v.length>1200)throw new OpenFinanceError('invalid_snapshot',502);return v;};
 const timestamp=(v:any)=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new OpenFinanceError('invalid_snapshot',502);return v;};
 if(p?.version!==1||!/^\d{4}-\d{2}$/.test(p.month)||!Array.isArray(p.bank?.balances)||!Array.isArray(p.transactions)||!Array.isArray(p.coverage?.missing))throw new OpenFinanceError('invalid_snapshot',502);
 const classification=(v:any)=>{
  if(!['alta','media','baixa'].includes(v.confidence)||!['banco_estabelecimento','banco','notion'].includes(v.source)||!['expense_candidate','transfer_candidate','card_payment_candidate','income_unresolved','unresolved'].includes(v.nature)||v.confirmed!==false)throw new OpenFinanceError('invalid_classification',502);
  return {category:str(v.category),confidence:str(v.confidence),reason:str(v.reason),source:str(v.source),nature:str(v.nature),confirmed:false};
 };
 const age=now.getTime()-Date.parse(p.sourceUpdatedAt);
 const sourceState=p.sourceState==='consent_expired'?'consent_expired':Number.isFinite(age)&&age>=0&&age<=36*3600000&&p.sourceState==='available'?'available':'stale_or_unavailable';
 const count=(v:any)=>{if(!Number.isSafeInteger(v)||v<0)throw new OpenFinanceError('invalid_snapshot',502);return v;};
 const counts:Record<string,number>={};for(const key of ['ambiguous','review_candidate','identity_match','not_in_notion','pending','unmapped_account','unknown_due_to_partial_source'])if(p.reconciliation?.counts?.[key]!==undefined)counts[key]=count(p.reconciliation.counts[key]);
 return {version:1,month:p.month,generatedAt:timestamp(p.generatedAt),collectedAt:timestamp(p.collectedAt),sourceUpdatedAt:p.sourceUpdatedAt===null?null:timestamp(p.sourceUpdatedAt),sourceState,refreshPolicy:'meupluggy_24h_no_manual_update',
 coverage:{state:'partial',missing:p.coverage.missing.map(str),notionComplete:p.coverage.notionComplete===true},
 bank:{daily:(p.bank.daily||[]).map((d:any)=>({date:str(d.date),inflowMinor:cents(d.inflowMinor),outflowMinor:cents(d.outflowMinor)})),balances:p.bank.balances.map((a:any)=>({accountId:str(a.accountId),name:str(a.name),currency:a.currency==='BRL'?'BRL':(()=>{throw new OpenFinanceError('unsupported_currency');})(),balanceMinor:cents(a.balanceMinor)})),postedCount:count(p.bank.postedCount),inflowMinor:cents(p.bank.inflowMinor),outflowMinor:cents(p.bank.outflowMinor)},
 notion:{recordCount:count(p.notion.recordCount),receivedMinor:cents(p.notion.receivedMinor),expenseMinor:cents(p.notion.expenseMinor),reimbursementMinor:cents(p.notion.reimbursementMinor),cardPaymentMinor:cents(p.notion.cardPaymentMinor),reconciledWithApi:p.notion.reconciledWithApi===true},
 reconciliation:{counts,applied:count(p.reconciliation.applied)},commitmentsState:'not_loaded',
 transactions:p.transactions.slice(0,1500).map((t:any)=>({id:str(t.id),date:timestamp(t.date),description:str(t.description),amountMinor:cents(t.amountMinor),...(t.accountId?{accountId:str(t.accountId)}:{}),...(t.providerCategory?{providerCategory:str(t.providerCategory)}:{}),...(t.classification?{classification:classification(t.classification)}:{})}))};
}
