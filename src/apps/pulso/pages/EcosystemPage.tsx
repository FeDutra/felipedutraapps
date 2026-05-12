'use client';

import React from 'react';
import { areasService } from '../services/areasService';
import { projectsService } from '../services/projectsService';
import { sourcesService } from '../services/sourcesService';
import { peopleService } from '../services/peopleService';
import { tasksService } from '../services/tasksService';
import { decisionsService } from '../services/decisionsService';
import { inboxService } from '../services/inboxService';
import { authService } from '../../../shared/services/authService';
import { AlertCircle } from 'lucide-react';
import { 
  Area, 
  Project, 
  Source, 
  Person 
} from '../types/pulso.types';
import { EcosystemTabs, EcosystemTabType } from '../components/ecosystem/EcosystemTabs';
import { AreaCard, ProjectCard, SourceCard, PersonCard } from '../components/ecosystem/EntityCards';
import { EntityDetailDrawer } from '../components/ecosystem/EntityDetailDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Database, UserPlus } from 'lucide-react';
import { SourceRequestDrawer, PersonRequestDrawer } from '../components/system/RequestDrawers';

export default function EcosystemPage() {
  const [activeTab, setActiveTab] = React.useState<EcosystemTabType>('areas');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Data States
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [areaStats, setAreaStats] = React.useState<Record<string, any>>({});

  // Selection
  const [selectedEntity, setSelectedEntity] = React.useState<{ type: any, id: string } | null>(null);

  // Request Drawers
  const [sourceDrawerOpen, setSourceDrawerOpen] = React.useState(false);
  const [personDrawerOpen, setPersonDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        
        await authService.ensurePulsoAuthReady();
        
        const [allAreas, allProjects, allSources, allPeople] = await Promise.all([
          areasService.getAll(),
          projectsService.getAll(),
          sourcesService.getAll(),
          peopleService.getAll()
        ]);
        
        setAreas(allAreas);
        setProjects(allProjects);
        setSources(allSources);
        setPeople(allPeople);

        // Load stats for areas
        const statsMap: any = {};
        for (const area of allAreas) {
          statsMap[area.id] = await areasService.getStats(area.id);
        }
        setAreaStats(statsMap);
      } catch (err: any) {
        console.error('Ecosystem load error:', err);
        setError(err.message || 'Erro ao sintonizar estruturas do ecossistema.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredData = React.useMemo(() => {
    const q = searchQuery.toLowerCase();
    switch(activeTab) {
      case 'areas': return areas.filter(a => a.name.toLowerCase().includes(q));
      case 'projects': return projects.filter(p => p.name.toLowerCase().includes(q));
      case 'sources': return sources.filter(s => s.name.toLowerCase().includes(q));
      case 'people': return people.filter(p => p.name.toLowerCase().includes(q));
      default: return [];
    }
  }, [activeTab, searchQuery, areas, projects, sources, people]);

  const tabs = [
    { id: 'areas' as const, label: 'Áreas', count: areas.length },
    { id: 'projects' as const, label: 'Projetos', count: projects.length },
    { id: 'sources' as const, label: 'Fontes', count: sources.length },
    { id: 'people' as const, label: 'Pessoas', count: people.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Ecossistema</h1>
          <p className="text-sm text-white/40 max-w-lg">
            Navegue pela estrutura orgânica de Áreas, Projetos e Fontes que compõem o ecossistema ÉDEN.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSourceDrawerOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-all"
          >
            <Database size={14} className="text-emerald-400" /> Registrar Fonte
          </button>
          <button 
            onClick={() => setPersonDrawerOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-all"
          >
            <UserPlus size={14} className="text-amber-400" /> Registrar Pessoa
          </button>
          <EcosystemTabs activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <input 
            type="text"
            placeholder={`Buscar em ${activeTab}...`}
            className="w-full bg-white/2 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-white/10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="p-4 bg-white/2 border border-white/5 rounded-2xl text-white/40 hover:bg-white/5 transition-all">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Grid View */}
      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sintonizando Estruturas</p>
        </div>
      ) : error ? (
        <div className="py-40 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Falha na Sintonização</h2>
          <p className="text-sm text-white/40 max-w-sm mb-8 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {activeTab === 'areas' && filteredData.map((a: any) => (
              <AreaCard key={a.id} area={a} stats={areaStats[a.id]} onClick={() => setSelectedEntity({ type: 'area', id: a.id })} />
            ))}
            {activeTab === 'projects' && filteredData.map((p: any) => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                areaName={areas.find(a => a.id === p.areaRef)?.name}
                onClick={() => setSelectedEntity({ type: 'project', id: p.id })} 
              />
            ))}
            {activeTab === 'sources' && filteredData.map((s: any) => (
              <SourceCard key={s.id} source={s} onClick={() => setSelectedEntity({ type: 'source', id: s.id })} />
            ))}
            {activeTab === 'people' && filteredData.map((p: any) => (
              <PersonCard key={p.id} person={p} onClick={() => setSelectedEntity({ type: 'person', id: p.id })} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && filteredData.length === 0 && (
        <div className="py-40 text-center border border-dashed border-white/5 rounded-3xl">
          <p className="text-white/20 italic text-sm">Nenhum resultado para sua busca.</p>
        </div>
      )}

      {/* Detail Drawer */}
      <EntityDetailDrawer 
        type={selectedEntity?.type || null}
        id={selectedEntity?.id || null}
        onClose={() => setSelectedEntity(null)}
        onNavigate={(type, id) => setSelectedEntity({ type, id })}
      />

      {/* Request Drawers */}
      <SourceRequestDrawer 
        isOpen={sourceDrawerOpen}
        onClose={() => setSourceDrawerOpen(false)}
        onSuccess={() => {
          // Success feedback
        }}
      />
      <PersonRequestDrawer 
        isOpen={personDrawerOpen}
        onClose={() => setPersonDrawerOpen(false)}
        onSuccess={() => {
          // Success feedback
        }}
      />
    </div>
  );
}
