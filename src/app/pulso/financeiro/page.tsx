import {Suspense} from 'react';
import FinancePage from '@/apps/pulso/pages/FinancePage';
export const metadata={title:'PULSO | Financeiro'};
export default function Page(){return <Suspense fallback={<p>Consultando financeiro…</p>}><FinancePage/></Suspense>;}
