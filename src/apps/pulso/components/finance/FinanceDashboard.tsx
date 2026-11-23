'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import FinanceWorkspace from './FinanceWorkspace';
import {authService} from '@/shared/services/authService';
export interface FinanceSnapshot {
 version:1;month:string;generatedAt:string;collectedAt:string;sourceUpdatedAt:string|null;sourceState:string;
 coverage:{state:string;missing:string[];notionComplete:boolean};
 bank:{daily:{date:string;inflowMinor:number;outflowMinor:number}[];balances:{accountId:string;name:string;currency:string;balanceMinor:number}[];postedCount:number;inflowMinor:number;outflowMinor:number};
 notion:{recordCount:number;receivedMinor:number;expenseMinor:number;reimbursementMinor:number;cardPaymentMinor:number;reconciledWithApi:boolean};
 reconciliation:{counts:Record<string,number>;applied:number};commitmentsState:string;
 transactions:{id:string;date:string;description:string;amountMinor:number;accountId?:string;providerCategory?:string;classification?:{category:string;confidence:'alta'|'media'|'baixa';reason:string;source:string;nature:string;confirmed:false}}[];
}
const api=process.env.NEXT_PUBLIC_PULSO_OPEN_FINANCE_API_BASE||'/api/open-finance';
const date=(s:string|null)=>s?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(s)):'não informado';
export default function FinanceDashboard({previewToken,active=true}: {previewToken?:string;active?:boolean} = {}){
 const [data,setData]=useState<FinanceSnapshot|null>(null),[hidden,setHidden]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const abort=useRef<AbortController|null>(null);const serial=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++serial.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setError('');const timer=setTimeout(()=>{controller.abort();if(current===serial.current){setError('A consulta demorou além do esperado. Tente atualizar novamente.');setBusy(false);}},20000);
  try{
   let authorization:string;
   if(previewToken){authorization=`FinancePreview ${previewToken}`;}else{const user=authService.getCurrentUser();if(!user||user.isAnonymous)throw Error('authentication_required');authorization=`Bearer ${await user.getIdToken()}`;}
   const res=await fetch(`${api}/snapshot`,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:'{}',signal:controller.signal,cache:'no-store'});
   const v=await res.json();if(!res.ok)throw Error(v.error||'snapshot_unavailable');
   if(v.version!==1||!Array.isArray(v.bank?.balances)||!Array.isArray(v.transactions))throw Error('invalid_snapshot');
   if(current===serial.current)setData(v);
  }catch(e){if(controller.signal.aborted)return;if(current===serial.current)setError(e instanceof Error&&e.message==='preview_access_expired_or_invalid'?'Este acesso privado expirou ou foi revogado.':e instanceof Error&&e.message==='snapshot_not_ready'?'A conexão existe; a leitura consolidada ainda não foi publicada.':e instanceof Error&&e.message==='authentication_required'?'Entre na PULSO para consultar o financeiro.':'Não foi possível renovar a leitura. Os dados anteriores, se visíveis, não foram atualizados.');}
  finally{clearTimeout(timer);if(current===serial.current)setBusy(false);}
 },[previewToken]);
 useEffect(()=>{const focus=()=>{void refresh();};const visible=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);const off=previewToken?()=>{}:authService.onAuthStateChange(()=>{abort.current?.abort();serial.current++;setData(null);void refresh();});return()=>{abort.current?.abort();serial.current++;off();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);};},[refresh,previewToken]);
 useEffect(()=>{if(active)void refresh();},[active,refresh]);
 return <section aria-label="Painel financeiro" className="h-full overflow-y-auto px-5 py-8 md:px-10 text-[#fbf9f5] font-light" aria-busy={busy}>
  <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] tracking-[.2em] opacity-40">FINANCEIRO · FONTES DISPONÍVEIS</p><h1 className="mt-2 text-2xl font-light tracking-tight">Financeiro</h1></div><div className="flex gap-4 text-xs"><button onClick={()=>setHidden(v=>!v)} aria-pressed={hidden}>[ {hidden?'mostrar':'ocultar'} valores ]</button><button onClick={()=>void refresh()} disabled={busy}>[ {busy?'consultando…':'atualizar ↻'} ]</button></div></header>
  {error&&<p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
  {!data&&!busy&&<p className="mt-10 text-sm opacity-60">Nenhum valor é presumido enquanto a consulta não estiver disponível.</p>}
  {data&&<>
   <details className="mt-4 text-[11px] leading-6 text-[#aaa9a1]"><summary className="cursor-pointer">Cobertura parcial · {data.month.split('-').reverse().join('/')} · fontes e atualização</summary><div className="pt-3"><p>Fonte bancária: {date(data.sourceUpdatedAt)} · coleta: {date(data.collectedAt)}</p><p>{data.sourceState==='available'?'Fonte disponível na última coleta.':'Fonte desatualizada ou indisponível: não tratar como posição atual.'}</p><p>Pendentes de conexão: {data.coverage.missing.join(' · ')||'Nenhuma lacuna declarada.'}</p><p>Meu Pluggy atualiza a cada 24h. Atualizar o painel não força o banco.</p><p>Ausência de dados não comprova ausência de compromissos.</p></div></details>
   <FinanceWorkspace data={data} hidden={hidden}/>
  </>}
 </section>;
}
