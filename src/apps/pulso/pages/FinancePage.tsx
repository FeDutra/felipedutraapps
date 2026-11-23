'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import LivePage from './LivePage';
import FinanceDashboard from '../components/finance/FinanceDashboard';
import {sessionsService} from '../services/sessionsService';
import {authService} from '@/shared/services/authService';
import type {Session} from '../types/pulso.types';
export default function FinancePage(){
 const [previewToken,setPreviewToken]=useState<string|null>(null);
 const [sessions,setSessions]=useState<Session[]>([]),[selected,setSelected]=useState<string|null>(null),[listing,setListing]=useState(true),[panel,setPanel]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const supplied=new URLSearchParams(window.location.hash.slice(1)).get('access');
  let stored:string|null=null;try{stored=sessionStorage.getItem('pulso-finance-preview-access');}catch{}
  const access=supplied||stored;
  if(access&&/^fp1_[A-Za-z0-9_-]{43}$/.test(access)){setPreviewToken(access);try{sessionStorage.setItem('pulso-finance-preview-access',access);}catch{}if(supplied)history.replaceState(null,'',window.location.pathname+window.location.search);return;}
  let alive=true;let epoch=0;const off=authService.onAuthStateChange(user=>{const current=++epoch;setSessions([]);setSelected(null);setListing(true);if(!user||user.isAnonymous){setError('Entre na PULSO para abrir suas sessões financeiras.');return;}void sessionsService.getAll().then(v=>{if(alive&&current===epoch){setSessions(v.filter(s=>!s.archived&&['dinheiro','area_dinheiro','financeiro','area_financeiro'].includes(s.areaId||'')));setError('');}}).catch(()=>{if(alive&&current===epoch)setError('Não foi possível consultar as sessões.');});});return()=>{alive=false;epoch++;off();};},[]);
 if(previewToken)return <div data-finance-build={process.env.NEXT_PUBLIC_PULSO_FINANCE_SHA || 'local-unpublished'} className="fixed inset-0 bg-[#0f0f0f] text-[#fbf9f5] font-sans"><div className="h-12 px-5 flex items-center justify-between text-xs opacity-60"><span>Prévia privada · somente leitura · sem Google</span><button onClick={()=>{try{sessionStorage.removeItem('pulso-finance-preview-access');}catch{}setPreviewToken(null);window.location.reload();}}>[ sair ]</button></div><div className="h-[calc(100%-3rem)] max-w-6xl mx-auto"><FinanceDashboard previewToken={previewToken}/></div></div>;
 return <div data-finance-build={process.env.NEXT_PUBLIC_PULSO_FINANCE_SHA || "local-unpublished"} className="finance-workspace fixed inset-0 bg-[#0f0f0f] text-[#fbf9f5] font-sans">
  <nav className="absolute top-0 inset-x-0 z-[80] h-12 px-5 flex justify-between items-center text-[11px] bg-[#0f0f0f]/60 backdrop-blur-xl"><div className="flex gap-5"><Link href="/pulso/live">[ voltar à PULSO ]</Link>{selected&&<button onClick={()=>setListing(v=>!v)}>[ {listing?'voltar à conversa':'sessões'} ]</button>}</div>{!listing&&<button className="md:hidden" onClick={()=>setPanel(v=>!v)}>[ {panel?'conversa':'painel'} ]</button>}</nav>
  {listing&&<section className="absolute inset-0 pt-24 px-8 md:px-16 overflow-y-auto z-[75] bg-[#0f0f0f]">
   <p className="text-[10px] tracking-[.2em] opacity-40">PULSO / DINHEIRO</p><h1 className="text-3xl font-light mt-4">Financeiro</h1><p className="mt-5 text-sm opacity-50">Conversas diferentes, a mesma base financeira.</p>{error&&<p className="mt-6 text-sm" role="alert">{error}</p>}
   <ul className="mt-12 space-y-10">{sessions.map(s=><li key={s.id}><button className="text-left" onClick={()=>{setSelected(s.id);setListing(false);setPanel(false);}}><span className="block text-xl font-light">{s.label}</span><span className="mt-2 block text-xs opacity-50">[ abrir conversa e painel ↗ ]</span></button></li>)}</ul>
   {!error&&!sessions.length&&<p className="mt-10 text-sm opacity-50">Aguardando sessões da área. Nenhuma sessão fictícia foi criada.</p>}
  </section>}
  {selected&&<div className={`absolute inset-x-0 top-12 bottom-0 md:flex ${listing?'invisible pointer-events-none':''}`}>
   <div className={`finance-conversation relative h-full min-w-0 w-full md:w-1/3 ${panel?'hidden md:block':''}`} style={{transform:'translateZ(0)',contain:'layout paint'}}><LivePage financeContextId={selected}/></div>
   <div className={`relative h-full min-w-0 w-full md:w-2/3 ${panel?'block':'hidden md:block'}`}><FinanceDashboard/></div>
  </div>}
 </div>;
}
