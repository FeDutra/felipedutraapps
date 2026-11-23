'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {authService} from '@/shared/services/authService';
export interface FinanceSnapshot {
 version:1;month:string;generatedAt:string;collectedAt:string;sourceUpdatedAt:string|null;sourceState:string;
 coverage:{state:string;missing:string[];notionComplete:boolean};
 bank:{daily:{date:string;inflowMinor:number;outflowMinor:number}[];balances:{accountId:string;name:string;currency:string;balanceMinor:number}[];postedCount:number;inflowMinor:number;outflowMinor:number};
 notion:{recordCount:number;receivedMinor:number;expenseMinor:number;reimbursementMinor:number;cardPaymentMinor:number;reconciledWithApi:boolean};
 reconciliation:{counts:Record<string,number>;applied:number};commitmentsState:string;
 transactions:{id:string;date:string;description:string;amountMinor:number}[];
}
const api=process.env.NEXT_PUBLIC_PULSO_OPEN_FINANCE_API_BASE||'/api/open-finance';
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const date=(s:string|null)=>s?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(s)):'não informado';
export default function FinanceDashboard(){
 const [data,setData]=useState<FinanceSnapshot|null>(null),[hidden,setHidden]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const abort=useRef<AbortController|null>(null);const serial=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++serial.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setError('');
  try{
   const user=authService.getCurrentUser();if(!user||user.isAnonymous)throw Error('authentication_required');
   const token=await user.getIdToken();
   const res=await fetch(`${api}/snapshot`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:controller.signal,cache:'no-store'});
   const v=await res.json();if(!res.ok)throw Error(v.error||'snapshot_unavailable');
   if(v.version!==1||!Array.isArray(v.bank?.balances)||!Array.isArray(v.transactions))throw Error('invalid_snapshot');
   if(current===serial.current)setData(v);
  }catch(e){if(controller.signal.aborted)return;if(current===serial.current)setError(e instanceof Error&&e.message==='snapshot_not_ready'?'A conexão existe; a leitura consolidada ainda não foi publicada.':e instanceof Error&&e.message==='authentication_required'?'Entre na PULSO para consultar o financeiro.':'Não foi possível renovar a leitura. Os dados anteriores, se visíveis, não foram atualizados.');}
  finally{if(current===serial.current)setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();const focus=()=>{void refresh();};const visible=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);const off=authService.onAuthStateChange(()=>{abort.current?.abort();serial.current++;setData(null);void refresh();});return()=>{abort.current?.abort();serial.current++;off();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);};},[refresh]);
 const value=(n:number)=>hidden?'••••':money(n);
 return <section aria-label="Painel financeiro" className="h-full overflow-y-auto px-5 py-8 md:px-10 text-[#fbf9f5] font-light" aria-busy={busy}>
  <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] tracking-[.2em] opacity-40">FINANCEIRO · FAMÍLIA</p><h1 className="mt-2 text-2xl font-light">Leitura do mês</h1></div><div className="flex gap-4 text-xs"><button onClick={()=>setHidden(v=>!v)} aria-pressed={hidden}>[ {hidden?'mostrar':'ocultar'} valores ]</button><button onClick={()=>void refresh()} disabled={busy}>[ {busy?'consultando…':'atualizar ↻'} ]</button></div></header>
  <p className="mt-6 text-xs opacity-55">Meu Pluggy atualiza a cada 24h. Atualizar este painel não força o banco.</p>
  {error&&<p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
  {!data&&!busy&&<p className="mt-10 text-sm opacity-60">Nenhum valor é presumido enquanto a consulta não estiver disponível.</p>}
  {data&&<>
   <div className="mt-6 text-xs leading-6 opacity-60"><p>Cobertura parcial · {data.month.split('-').reverse().join('/')}</p><p>Fonte bancária: {date(data.sourceUpdatedAt)} · leitura coletada: {date(data.collectedAt)}</p><p>{data.sourceState==='available'?'Fonte disponível na última coleta.':'Fonte desatualizada ou indisponível: não tratar como posição atual.'}</p><p>Pendentes de conexão: {data.coverage.missing.join(' · ')}</p></div>
   <h2 className="mt-9 text-xs tracking-widest opacity-50">SALDO OBSERVADO · NÃO É CAIXA LIVRE</h2>
   {data.bank.balances.map(a=><div key={a.accountId} className="mt-5"><p className="text-xs opacity-50">{a.name} · {a.currency}</p><p className="mt-2 text-3xl">{value(a.balanceMinor)}</p></div>)}
   <div className="grid grid-cols-2 gap-6 mt-10"><div><p className="text-xs opacity-50">Entradas bancárias</p><p className="text-xl mt-2">{value(data.bank.inflowMinor)}</p></div><div><p className="text-xs opacity-50">Saídas bancárias</p><p className="text-xl mt-2">{value(data.bank.outflowMinor)}</p></div></div>
   <p className="mt-3 text-xs opacity-40">{data.bank.postedCount} movimentos efetivados no mês. Saída bancária inclui transferências e pagamentos de cartão.</p>
   {!hidden&&!!data.bank.daily?.length&&<figure className="mt-8"><figcaption className="text-xs opacity-50">Fluxo bancário diário · entradas e saídas · valores brutos</figcaption><svg viewBox="0 0 600 140" role="img" aria-label="Evolução diária de entradas e saídas bancárias" className="mt-4 w-full h-auto"><title>Fluxo bancário, não resultado econômico</title>{(['inflowMinor','outflowMinor'] as const).map((key,index)=>{const max=Math.max(1,...data.bank.daily.flatMap(d=>[d.inflowMinor,d.outflowMinor]));return <polyline key={key} fill="none" stroke={index?'#e5b7a7':'#b9d1bd'} strokeWidth="1.5" strokeDasharray={index?'4 4':undefined} points={data.bank.daily.map((d,i)=>`${10+i*580/Math.max(1,data.bank.daily.length-1)},${130-d[key]*120/max}`).join(' ')}/>;})}</svg><p className="text-[10px] opacity-40">Linha contínua: entradas · tracejada: saídas</p></figure>}
   <h2 className="mt-10 text-xs tracking-widest opacity-50">CLASSIFICAÇÃO NO NOTION · CONTAS MAPEADAS</h2>
   <div className="grid grid-cols-2 gap-6 mt-5"><div><p className="text-xs opacity-50">Receitas classificadas</p><p className="text-xl mt-2">{value(data.notion.receivedMinor)}</p></div><div><p className="text-xs opacity-50">Despesas classificadas</p><p className="text-xl mt-2">{value(data.notion.expenseMinor)}</p></div></div>
   <p className="mt-4 text-xs leading-6 opacity-50">Pagamentos de cartão separados: {value(data.notion.cardPaymentMinor)}. Reembolsos: {value(data.notion.reimbursementMinor)}. {data.notion.reconciledWithApi?'Vínculos conciliados.':'Histórico ainda não conciliado com esta API; não somar os dois conjuntos.'}</p>
   <h2 className="mt-10 text-xs tracking-widest opacity-50">PARA CONFERIR COM A LASTRO</h2><p className="mt-4 text-sm opacity-65">Correspondências ambíguas: {data.reconciliation.counts.ambiguous||0}. Sugestões para revisão: {data.reconciliation.counts.review_candidate||0}. Nenhum pagamento é confirmado apenas por semelhança.</p>
   {data.commitmentsState!=='loaded'&&<p className="mt-4 text-xs opacity-50">Compromissos e orçamento ainda não carregados nesta leitura. Ausência de dados não significa ausência de contas a pagar.</p>}
   <h2 className="mt-10 text-xs tracking-widest opacity-50">MOVIMENTOS RECENTES</h2>
   {hidden?<p className="mt-5 text-sm opacity-50">Movimentações ocultas por privacidade.</p>:<ul className="mt-5 space-y-5">{data.transactions.map(t=><li key={t.id} className="flex justify-between gap-6 text-xs"><div><p>{t.description}</p><p className="opacity-40 mt-1">{date(t.date)}</p></div><span className="whitespace-nowrap">{value(t.amountMinor)}</span></li>)}</ul>}
  </>}
 </section>;
}
