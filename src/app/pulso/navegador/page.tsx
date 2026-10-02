import { redirect } from 'next/navigation';

export const metadata = {
  title: 'PULSO | Navegador',
  description: 'Navegador integrado da PULSO',
};

export default function Page() {
  // Navegador deixou de ser uma rota que toma a tela: ele mora na MESA.
  redirect('/pulso/live');
}
