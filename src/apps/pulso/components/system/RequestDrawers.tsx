'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Activity, Shield, Users, Layers, MessageSquare, Info, AlertTriangle, Database, UserPlus } from 'lucide-react';
import { areasService, projectsService, sourcesService, peopleService, requestsService } from '../../services/pulsoService';
import { Area, Project, Source, Person, RequestType, Priority } from '../../types/pulso.types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * AGENT REQUEST DRAWER
 */
export const AgentRequestDrawer = ({ isOpen, onClose, onSuccess }: DrawerProps) => {
  const [loading, setLoading] = React.useState(false);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  
  const [formData, setFormData] = React.useState({
    name: '',
    areaRef: '',
    projectRef: '',
    mission: '',
    inputs: '',
    outputs: '',
    sourceRefs: [] as string[],
    autonomy: 'L1',
    cadence: 'Daily',
    notes: '',
    risk: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      Promise.all([
        areasService.getAll(),
        projectsService.getAll()
      ]).then(([a, p]) => {
        setAreas(a);
        setProjects(p);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestsService.createRequest({
        requestType: 'create_agent',
        title: `Solicitação: Novo Agente - ${formData.name}`,
        summary: formData.mission,
        status: 'requested',
        priority: 'medium',
        areaRef: formData.areaRef,
        projectRef: formData.projectRef || null,
        requestedBy: 'user_felipe', 
        payload: {
          provisionalName: formData.name,
          mission: formData.mission,
          inputs: formData.inputs || null,
          outputs: formData.outputs || null,
          sourceRefs: formData.sourceRefs.length > 0 ? formData.sourceRefs : null,
          autonomyLevel: formData.autonomy,
          cadence: formData.cadence || null,
          notes: formData.notes || null,
          riskAssessment: formData.risk || null
        }
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating agent request:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar">
            <div className="p-8">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <Zap size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Solicitar Novo Agente</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">Camada de Inteligência Lótus</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Nome Provisório</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" placeholder="Ex: Agente de Auditoria" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Área *</label>
                      <select required value={formData.areaRef} onChange={e => setFormData({ ...formData, areaRef: e.target.value })} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none">
                        <option value="">Selecionar Área</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Projeto</label>
                      <select value={formData.projectRef} onChange={e => setFormData({ ...formData, projectRef: e.target.value })} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none">
                        <option value="">Selecionar Projeto</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Missão do Agente *</label>
                    <textarea required value={formData.mission} onChange={e => setFormData({ ...formData, mission: e.target.value })} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white h-32 resize-none focus:border-blue-500/50 outline-none transition-all" placeholder="O que este agente deve resolver?" />
                  </div>
                </div>

                <div className="bg-white/2 border border-white/5 rounded-3xl p-8 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Autonomia (L0-L4)</label>
                    <select value={formData.autonomy} onChange={e => setFormData({ ...formData, autonomy: e.target.value })} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500/50 outline-none transition-all appearance-none">
                      <option value="L0">L0 - Manual Assistido</option>
                      <option value="L1">L1 - Sugestão Automática</option>
                      <option value="L2">L2 - Execução com Confirmação</option>
                      <option value="L3">L3 - Autônomo com Relato</option>
                      <option value="L4">L4 - Autônomo Pleno (REQUER APROVAÇÃO EXTRA)</option>
                    </select>
                    {formData.autonomy === 'L4' && (
                      <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 items-start">
                        <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-red-200 leading-tight">L4 exige aprovação posterior e não cria agente ativo automaticamente.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-red-500/40 ml-1 flex items-center gap-2"><AlertTriangle size={12} /> Risco se falhar</label>
                  <input value={formData.risk} onChange={e => setFormData({ ...formData, risk: e.target.value })} className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl px-6 py-4 text-sm text-red-200 focus:border-red-500/50 outline-none transition-all" placeholder="Ex: Perda de dados, Delay operacional" />
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button type="button" onClick={onClose} className="flex-1 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all">Cancelar</button>
                  <button type="submit" disabled={loading} className="flex-[2] py-4 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Zap size={14} /> Solicitar Agente</>}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * SOURCE REQUEST DRAWER
 */
export const SourceRequestDrawer = ({ isOpen, onClose, onSuccess }: DrawerProps) => {
  const [loading, setLoading] = React.useState(false);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [formData, setFormData] = React.useState({
    name: '',
    type: 'google_sheets',
    areaRef: '',
    projectRef: '',
    link: '',
    relevance: 'high',
    role: '',
    notes: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      Promise.all([areasService.getAll(), projectsService.getAll()]).then(([a, p]) => {
        setAreas(a);
        setProjects(p);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestsService.createRequest({
        requestType: 'register_source',
        title: `Solicitação: Registrar Fonte - ${formData.name}`,
        summary: `Registro de nova fonte de dados: ${formData.type}`,
        status: 'requested',
        priority: formData.relevance === 'high' ? 'high' : 'medium',
        areaRef: formData.areaRef,
        projectRef: formData.projectRef || null,
        requestedBy: 'user_felipe',
        payload: { ...formData }
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar">
            <div className="p-8">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20"><Database size={24} className="text-emerald-400" /></div>
                  <div>
                    <h2 className="text-xl font-black text-white">Registrar Fonte</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">Ingestão de Dados Externos</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Nome da Fonte *</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white" placeholder="Ex: Planilha de Custos" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Tipo</label>
                      <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white appearance-none">
                        <option value="google_sheets">Google Sheets</option>
                        <option value="web_page">Web Page / API</option>
                        <option value="pdf_doc">Documento PDF</option>
                        <option value="manual_input">Entrada Manual</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Área *</label>
                      <select required value={formData.areaRef} onChange={e => setFormData({...formData, areaRef: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white appearance-none">
                        <option value="">Selecionar Área</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Relevância</label>
                      <select value={formData.relevance} onChange={e => setFormData({...formData, relevance: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white appearance-none">
                        <option value="high">Alta (Auditada)</option>
                        <option value="medium">Média (Informativa)</option>
                        <option value="low">Baixa (Background)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Link / Origem</label>
                    <input value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white" placeholder="https://..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Papel da Fonte</label>
                    <textarea value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white h-24 resize-none" placeholder="Qual o papel desta fonte no ecossistema?" />
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button type="button" onClick={onClose} className="flex-1 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all">Cancelar</button>
                  <button type="submit" disabled={loading} className="flex-[2] py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Database size={14} /> Solicitar Registro</>}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * PERSON REQUEST DRAWER
 */
export const PersonRequestDrawer = ({ isOpen, onClose, onSuccess }: DrawerProps) => {
  const [loading, setLoading] = React.useState(false);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [formData, setFormData] = React.useState({
    name: '',
    contact: '',
    areaRef: '',
    relationType: 'partner',
    role: '',
    attentionLevel: 'normal',
    notes: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      areasService.getAll().then(a => setAreas(a));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestsService.createRequest({
        requestType: 'register_person',
        title: `Solicitação: Registrar Pessoa - ${formData.name}`,
        summary: `Cadastro de novo stakeholder: ${formData.role}`,
        status: 'requested',
        priority: formData.attentionLevel === 'high' ? 'high' : 'medium',
        areaRef: formData.areaRef,
        requestedBy: 'user_felipe',
        payload: { ...formData }
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar">
            <div className="p-8">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20"><UserPlus size={24} className="text-amber-400" /></div>
                  <div>
                    <h2 className="text-xl font-black text-white">Registrar Pessoa</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">Gestão de Stakeholders</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Nome Completo *</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white" placeholder="Ex: Carlos Oliveira" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Área Relacionada *</label>
                      <select required value={formData.areaRef} onChange={e => setFormData({...formData, areaRef: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white appearance-none">
                        <option value="">Selecionar Área</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Nível de Atenção</label>
                      <select value={formData.attentionLevel} onChange={e => setFormData({...formData, attentionLevel: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white appearance-none">
                        <option value="normal">Normal</option>
                        <option value="high">Alta (VIP / Urgente)</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Contato (Opcional)</label>
                    <input value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white" placeholder="E-mail, WhatsApp, LinkedIn" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Papel / Função</label>
                    <textarea value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white h-24 resize-none" placeholder="Ex: Desenvolvedor, Cliente, Gerente de Projeto" />
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button type="button" onClick={onClose} className="flex-1 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all">Cancelar</button>
                  <button type="submit" disabled={loading} className="flex-[2] py-4 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><UserPlus size={14} /> Solicitar Cadastro</>}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
