'use client';

import React from 'react';
import { seedPulsoFirestore } from '@/apps/pulso/services/seedPulsoFirestore';

export default function SeedPage() {
  const [status, setStatus] = React.useState('Aguardando...');

  const runSeed = async () => {
    setStatus('Rodando Seed v2...');
    try {
      await seedPulsoFirestore();
      setStatus('Seed v2 Concluído com Sucesso!');
    } catch (err) {
      setStatus('Erro: ' + (err as any).message);
    }
  };

  return (
    <div className="p-20 text-center">
      <h1 className="text-2xl font-black mb-8">PULSO Admin: Seed v2</h1>
      <button 
        onClick={runSeed}
        className="px-8 py-4 bg-blue-500 text-white font-black rounded-2xl"
      >
        Executar Seed Incremental
      </button>
      <p className="mt-8 text-white/40">{status}</p>
    </div>
  );
}
