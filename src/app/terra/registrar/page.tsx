'use client';

import React, { useState } from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { 
  CloudRain, 
  Sprout, 
  Scissors, 
  Biohazard, 
  Droplets, 
  Camera, 
  ClipboardList, 
  ChevronLeft,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { mockAreas, mockPlants, mockWeather, mockLunar } from '@/shared/mocks/data';
import { PropertyEvent } from '@/shared/types';

const actionTypes = [
  { id: 'chuva', icon: CloudRain, label: 'Choveu', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'plantio', icon: Sprout, label: 'Plantei', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'poda', icon: Scissors, label: 'Podei', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { id: 'irrigacao', icon: Droplets, label: 'Irriguei', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  { id: 'colheita', icon: ClipboardList, label: 'Colhi', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { id: 'praga', icon: Biohazard, label: 'Vi uma praga', color: 'text-red-400', bg: 'bg-red-400/10' },
  { id: 'foto', icon: Camera, label: 'Tirei uma foto', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'obs', icon: ClipboardList, label: 'Observação', color: 'text-slate-200', bg: 'bg-white/10' },
] as const;

type EventType = typeof actionTypes[number]['id'];

export default function RegistrarPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  const handleTypeSelect = (type: EventType) => {
    setSelectedType(type);
    setFormData({});
    setStep(2);
  };

  const generateSuggestion = (type: EventType, data: any) => {
    switch (type) {
      case 'chuva':
        if ((data.mm || 0) > 10 || data.intensity === 'forte') {
          return "Como choveu acima do previsto, observe áreas com solo encharcado e evite pisoteio.";
        }
        return "Solo umedecido. Ótimo momento para observar a absorção natural da terra.";
      case 'plantio':
        return `Plantio de ${data.culture} registrado. Acompanhe a germinação em 7-10 dias.`;
      case 'praga':
        return "Registro criado. Sugerimos fotografar o verso das folhas para monitorar a evolução.";
      case 'poda':
        return "Poda concluída. Observe o vigor da planta e a cicatrização dos cortes nos próximos dias.";
      case 'irrigacao':
        return "Irrigação registrada. O solo deve manter a umidade ideal. Verifique novamente amanhã.";
      case 'colheita':
        return `Colheita de ${data.culture || 'cultura'} salva. Excelente para o histórico de produtividade anual.`;
      case 'foto':
        return "Foto adicionada à linha do tempo. Isso ajuda muito na comparação visual de longo prazo.";
      case 'obs':
        return "Observação salva. Se isso for recorrente, você pode transformar em um lembrete.";
      default:
        return "Registro salvo com sucesso na memória da sua terra.";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call and context attachment
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const event: Partial<PropertyEvent> = {
      ...formData,
      type: selectedType,
      createdAt: new Date(),
      weatherSnapshot: mockWeather,
      moonSnapshot: mockLunar,
    };

    console.log('Saved Event:', event);
    setSuggestion(generateSuggestion(selectedType!, formData));
    setIsSaving(false);
    setStep(3);
  };

  const renderForm = () => {
    switch (selectedType) {
      case 'chuva':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Intensidade</label>
                <div className="flex flex-wrap gap-2">
                  {['garoa', 'chuva_fraca', 'moderada', 'forte', 'temporal'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFormData({ ...formData, intensity: opt })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                        formData.intensity === opt ? "bg-blue-500 border-blue-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                      )}
                    >
                      {opt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Duração</label>
                <select 
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="minutos" className="bg-slate-900">Poucos minutos</option>
                  <option value="menos_1h" className="bg-slate-900">Menos de 1h</option>
                  <option value="algumas_horas" className="bg-slate-900">Algumas horas</option>
                  <option value="madrugada" className="bg-slate-900">Madrugada</option>
                  <option value="dia_todo" className="bg-slate-900">O dia todo</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Milímetros (opcional)</label>
                <input 
                  type="number"
                  placeholder="Ex: 12"
                  onChange={e => setFormData({ ...formData, mm: Number(e.target.value) })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>

              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Impacto Percebido</label>
                <div className="grid grid-cols-2 gap-2">
                  {['solo_umido', 'solo_encharcado', 'escorreu_agua', 'sem_impacto'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFormData({ ...formData, impact: opt })}
                      className={cn(
                        "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-left",
                        formData.impact === opt ? "bg-blue-500 border-blue-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                      )}
                    >
                      {opt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'plantio':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Cultura / Planta</label>
                <input 
                  type="text"
                  placeholder="Ex: Alface"
                  onChange={e => setFormData({ ...formData, culture: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Variedade</label>
                <input 
                  type="text"
                  placeholder="Ex: Crespa"
                  onChange={e => setFormData({ ...formData, variety: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Área</label>
                <select 
                  onChange={e => setFormData({ ...formData, areaId: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione a área...</option>
                  {mockAreas.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Origem</label>
                <select 
                  onChange={e => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="semente" className="bg-slate-900">Semente</option>
                  <option value="muda" className="bg-slate-900">Muda</option>
                  <option value="estaquia" className="bg-slate-900">Estaquia</option>
                  <option value="transplante" className="bg-slate-900">Transplante</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Quantidade</label>
                <input 
                  type="number"
                  onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
            </div>
          </div>
        );

      case 'poda':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Planta</label>
                <select 
                  onChange={e => setFormData({ ...formData, plantId: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione a planta...</option>
                  {mockPlants.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Tipo de Poda</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'limpeza', label: 'Limpeza' },
                    { id: 'formacao', label: 'Formação' },
                    { id: 'conducao', label: 'Condução' },
                    { id: 'frutificacao', label: 'Frutificação' },
                    { id: 'contencao', label: 'Contenção' },
                    { id: 'doenca', label: 'Remoção Galho Doente' },
                  ].map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setFormData({ ...formData, pruningType: opt.id })}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-left",
                        formData.pruningType === opt.id ? "bg-amber-500 border-amber-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Intensidade</label>
                <select 
                  onChange={e => setFormData({ ...formData, intensity: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="leve" className="bg-slate-900">Leve</option>
                  <option value="moderada" className="bg-slate-900">Moderada</option>
                  <option value="forte" className="bg-slate-900">Forte</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Motivo</label>
                <input 
                  type="text"
                  placeholder="Ex: Manutenção"
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
            </div>
          </div>
        );

      case 'irrigacao':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Alvo</label>
                <select 
                  onChange={e => setFormData({ ...formData, targetId: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione Área ou Planta...</option>
                  <optgroup label="Áreas" className="bg-slate-900">
                    {mockAreas.map(a => <option key={a.id} value={`area:${a.id}`} className="bg-slate-900">{a.name}</option>)}
                  </optgroup>
                  <optgroup label="Plantas" className="bg-slate-900">
                    {mockPlants.map(p => <option key={p.id} value={`plant:${p.id}`} className="bg-slate-900">{p.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Tipo</label>
                <select 
                  onChange={e => setFormData({ ...formData, method: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="manual" className="bg-slate-900">Manual</option>
                  <option value="regador" className="bg-slate-900">Regador</option>
                  <option value="mangueira" className="bg-slate-900">Mangueira</option>
                  <option value="gotejamento" className="bg-slate-900">Gotejamento</option>
                  <option value="aspersao" className="bg-slate-900">Aspersão</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Duração (min)</label>
                <input 
                  type="number"
                  placeholder="Ex: 20"
                  onChange={e => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Solo Antes</label>
                <div className="grid grid-cols-2 gap-2">
                  {['seco', 'leve_umido', 'umido', 'encharcado'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFormData({ ...formData, soilBefore: opt })}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                        formData.soilBefore === opt ? "bg-sky-500 border-sky-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                      )}
                    >
                      {opt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'colheita':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Cultura</label>
                <input 
                  type="text"
                  placeholder="Ex: Milho"
                  onChange={e => setFormData({ ...formData, culture: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Área</label>
                <select 
                  onChange={e => setFormData({ ...formData, areaId: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  {mockAreas.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Quantidade</label>
                <input 
                  type="number"
                  onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Unidade</label>
                <select 
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="unidade" className="bg-slate-900">Unidade</option>
                  <option value="kg" className="bg-slate-900">Kg</option>
                  <option value="maco" className="bg-slate-900">Maço</option>
                  <option value="cesto" className="bg-slate-900">Cesto</option>
                  <option value="punhado" className="bg-slate-900">Punhado</option>
                </select>
              </div>
              <div className="space-y-4 text-left">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Qualidade</label>
                <select 
                  onChange={e => setFormData({ ...formData, quality: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="boa" className="bg-slate-900">Boa</option>
                  <option value="media" className="bg-slate-900">Média</option>
                  <option value="baixa" className="bg-slate-900">Baixa</option>
                  <option value="perda" className="bg-slate-900">Perdeu Parte</option>
                </select>
              </div>
              <div className="space-y-4 text-left">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Destino</label>
                <select 
                  onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="consumo" className="bg-slate-900">Consumo</option>
                  <option value="doacao" className="bg-slate-900">Doação</option>
                  <option value="venda" className="bg-slate-900">Venda</option>
                  <option value="semente" className="bg-slate-900">Semente</option>
                  <option value="compostagem" className="bg-slate-900">Compostagem</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'praga':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Em qual planta?</label>
                <select 
                  onChange={e => setFormData({ ...formData, plantId: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione a planta...</option>
                  {mockPlants.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Parte Afetada</label>
                <select 
                  onChange={e => setFormData({ ...formData, affectedPart: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="folha" className="bg-slate-900">Folha</option>
                  <option value="caule" className="bg-slate-900">Caule</option>
                  <option value="fruto" className="bg-slate-900">Fruto</option>
                  <option value="raiz" className="bg-slate-900">Raiz</option>
                  <option value="solo" className="bg-slate-900">Solo Próximo</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Intensidade</label>
                <select 
                  onChange={e => setFormData({ ...formData, intensity: e.target.value })}
                  className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  <option value="pouco" className="bg-slate-900">Pouco</option>
                  <option value="moderado" className="bg-slate-900">Moderado</option>
                  <option value="muito" className="bg-slate-900">Muito</option>
                  <option value="espalhando" className="bg-slate-900">Se espalhando</option>
                </select>
              </div>
              <div className="col-span-2 space-y-4">
                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Sinais Observados</label>
                <div className="grid grid-cols-2 gap-2">
                  {['inseto', 'ovo', 'mancha', 'furo', 'teia', 'folha_enrolada', 'mofo', 'murcha'].map(sign => (
                    <button 
                      key={sign}
                      onClick={() => {
                        const current = formData.signs || [];
                        const updated = current.includes(sign) ? current.filter((s: string) => s !== sign) : [...current, sign];
                        setFormData({ ...formData, signs: updated });
                      }}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-left",
                        formData.signs?.includes(sign) ? "bg-red-500 border-red-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                      )}
                    >
                      {sign.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-start gap-3">
              <Camera className="text-red-400 mt-0.5" size={18} />
              <p className="text-xs font-black text-white leading-tight uppercase tracking-tight">
                Fotos são fortemente recomendadas para análise com IA e acompanhamento.
              </p>
            </div>
          </div>
        );

      case 'foto':
        return (
          <div className="space-y-8">
            <div className="p-10 border-2 border-dashed border-white/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 bg-white/15 text-center group cursor-pointer hover:bg-white/20 transition-all">
              <div className="p-6 bg-purple-500/20 rounded-full group-hover:scale-110 transition-transform">
                <Camera className="text-purple-400" size={48} />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-widest">Tirar Foto Obrigatória</p>
                <p className="text-[11px] font-black text-white/70 uppercase mt-1">Toque para abrir a câmera</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Vincular a</label>
              <select 
                onChange={e => setFormData({ ...formData, linkedTo: e.target.value })}
                className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
              >
                <option value="property" className="bg-slate-900">Propriedade Inteira</option>
                {mockAreas.map(a => <option key={a.id} value={`area:${a.id}`} className="bg-slate-900">Área: {a.name}</option>)}
                {mockPlants.map(p => <option key={p.id} value={`plant:${p.id}`} className="bg-slate-900">Planta: {p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <button 
                onClick={() => setFormData({ ...formData, aiAnalysis: !formData.aiAnalysis })}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                  formData.aiAnalysis ? "bg-purple-500 border-purple-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                )}
               >
                 <Lightbulb size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-center">Analisar com IA</span>
               </button>
               <button 
                onClick={() => setFormData({ ...formData, compare: !formData.compare })}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                  formData.compare ? "bg-purple-500 border-purple-400 text-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                )}
               >
                 <ArrowRight size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-center">Comparar Anterior</span>
               </button>
            </div>
          </div>
        );

      case 'obs':
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Tipo de Observação</label>
              <div className="grid grid-cols-3 gap-2">
                {['solo', 'clima', 'planta', 'animal', 'estrutura', 'geral'].map(opt => (
                  <button 
                    key={opt}
                    onClick={() => setFormData({ ...formData, obsType: opt })}
                    className={cn(
                      "px-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-center",
                      formData.obsType === opt ? "bg-white text-slate-900 border-white" : "bg-white/15 border-white/30 text-white/80 hover:bg-white/20"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Vínculo (opcional)</label>
              <select 
                onChange={e => setFormData({ ...formData, linkedId: e.target.value })}
                className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-white/50 transition-colors"
              >
                <option value="" className="bg-slate-900">Nenhum</option>
                {mockAreas.map(a => <option key={a.id} value={`area:${a.id}`} className="bg-slate-900">Área: {a.name}</option>)}
                {mockPlants.map(p => <option key={p.id} value={`plant:${p.id}`} className="bg-slate-900">Planta: {p.name}</option>)}
              </select>
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Texto da Observação</label>
              <textarea 
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 h-40 text-sm font-bold text-white outline-none resize-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                placeholder="O que você observou?"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Observação</label>
              <textarea 
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white/15 border border-white/30 rounded-2xl p-4 h-32 text-sm font-bold text-white outline-none resize-none placeholder:text-white/50 focus:border-white/50 transition-colors"
                placeholder="Descreva os detalhes..."
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-20 min-h-[90vh] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <button 
          onClick={() => {
            if (step === 1) router.push('/terra');
            else if (step === 2) setStep(1);
            else router.push('/terra');
          }} 
          className="p-4 glass glass-interactive rounded-2xl border-white/10 text-white shadow-2xl"
        >
          {step === 1 ? <X size={24} /> : <ChevronLeft size={24} />}
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-white">
          {step === 1 ? 'O que aconteceu?' : step === 3 ? 'Sucesso!' : actionTypes.find(a => a.id === selectedType)?.label}
        </h1>
        <div className="w-12"></div>
      </header>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {actionTypes.map((action) => (
                <GlassCard 
                  key={action.id} 
                  className="flex flex-col items-center justify-center py-8 gap-4 border-white/5 hover:border-white/20 transition-all group glass-interactive"
                  onClick={() => handleTypeSelect(action.id)}
                >
                  <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", action.bg)}>
                    <action.icon size={32} className={action.color} />
                  </div>
                  <span className="font-black text-xs text-white uppercase tracking-widest">{action.label}</span>
                </GlassCard>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <GlassCard className="p-8 border-white/10">
                {renderForm()}
                
                <div className="mt-8 pt-8 border-t border-white/5">
                  <button className="w-full bg-white/10 glass glass-interactive p-6 rounded-2xl flex items-center justify-center gap-4 border border-white/10 text-white">
                    <Camera size={24} className="text-white/60" />
                    <span className="font-black text-xs uppercase tracking-[0.2em]">Adicionar Foto</span>
                  </button>
                </div>
              </GlassCard>

              <button 
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  "w-full p-6 rounded-3xl font-black text-xl tracking-tight transition-all flex items-center justify-center gap-3",
                  isSaving ? "bg-white/10 text-white/40" : "bg-emerald-600 text-white shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:bg-emerald-500"
                )}
              >
                {isSaving ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto py-10"
            >
              <GlassCard className="p-10 text-center space-y-8 border-emerald-500/20 bg-emerald-500/5">
                <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={42} className="text-emerald-400" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white">Registro Salvo!</h2>
                  <p className="text-sm font-medium text-white/60">A memória da sua terra foi atualizada.</p>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl text-left space-y-4 border border-white/5 relative overflow-hidden">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Lightbulb size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sugestão Contextual</span>
                  </div>
                  <p className="text-sm font-bold text-indigo-50 leading-snug relative z-10">
                    {suggestion}
                  </p>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 blur-2xl rounded-full" />
                </div>

                <div className="space-y-4 pt-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="w-full p-5 rounded-2xl bg-white/10 text-white font-black text-xs uppercase tracking-widest border border-white/5 hover:bg-white/20 transition-all"
                  >
                    Novo Registro
                  </button>
                  <button 
                    onClick={() => router.push('/terra')}
                    className="w-full p-5 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Voltar para Início
                    <ArrowRight size={16} />
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
