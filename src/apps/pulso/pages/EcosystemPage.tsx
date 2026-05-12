'use client';

import React from 'react';
import { areasService } from '../services/areasService';
import { projectsService } from '../services/projectsService';
import { sourcesService } from '../services/sourcesService';
import { peopleService } from '../services/peopleService';
import { authService } from '../../../shared/services/authService';
import { AlertCircle, Search, SlidersHorizontal, Database, UserPlus } from 'lucide-react';
import { 
  Area, 
  Project, 
  Source, 
  Person 
} from '../types/pulso.types';
import { EcosystemTabs, EcosystemTabType } from '../components/ecosystem/EcosystemTabs';
import { AreaCard, ProjectCard, SourceCard, PersonCard } from '../components/ecosystem/EntityCards';
import { EntityDetailDrawer } from '../components/ecosystem/EntityDetailDrawer';
import { UniversalFilterPanel } from '../components/system/UniversalFilterPanel';
import { SourceRequestDrawer, PersonRequestDrawer } from '../components/system/RequestDrawers';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [selectedEntity, setSelectedEntity] = React.useState<{ type: any; id: string } | null>(null);

  // Request Drawers
  const [sourceDrawerOpen, setSourceDrawerOpen] = React.useState(false);
  const [personDrawerOpen, setPersonDrawerOpen] = React.useState(false);

  // Reusable Filters State
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState({
    status: 'all',
    priority: 'all',
    area: 'all',
    project: 'all',
    type: 'all',
    dateRange: 'all',
    origin: 'all',
  });

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
    let baseList: any[] = [];
    switch(activeTab) {
      case 'areas': baseList = areas; break;
      case 'projects': baseList = projects; break;
      case 'sources': baseList = sources; break;
      case 'people': baseList = people; break;
      default: baseList = [];
    }

    return baseList.filter(item => {
      // Search
      if (q && !(item.name || '').toLowerCase().includes(q) && !(item.description || '').toLowerCase().includes(q)) {
        return false;
      }
      // Status
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
      // Priority
      if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) return false;
      // Area
      if (filters.area && filters.area !== 'all' && item.areaRef !== filters.area && item.id !== filters.area) return false;
      // Project
      if (filters.project && filters.project !== 'all' && item.projectRef !== filters.project && item.id !== filters.project) return false;
      
      // Date Range
      if (filters.dateRange && filters.dateRange !== 'all') {
        let dVal = item.createdAt || item.updatedAt;
        if (!dVal) return false;
        
        let dateObj: Date;
        if (typeof (dVal as any).toDate === 'function') {
          dateObj = (dVal as any).toDate();
        } else if ((dVal as any).seconds) {
          dateObj = new Date((dVal as any).seconds * 1000);
        } else {
          dateObj = new Date(dVal as any);
        }

        if (isNaN(dateObj.getTime())) return false;
        
        const now = new Date();
        if (filters.dateRange === 'today') {
          if (dateObj.toDateString() !== now.toDateString()) return false;
        } else if (filters.dateRange === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (dateObj < sevenDaysAgo) return false;
        } else if (filters.dateRange === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (dateObj < thirtyDaysAgo) return false;
        } else if (filters.dateRange === 'month') {
          if (dateObj.getMonth() !== now.getMonth() || dateObj.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [activeTab, searchQuery, areas, projects, sources, people, filters]);

  const tabs = [
    { id: 'areas' as const, label: 'Áreas', count: areas.length },
    { id: 'projects' as const, label: 'Projetos', count: projects.length },
    { id: 'sources' as const, label: 'Fontes', count: sources.length },
    { id: 'people' as const, label: 'Pessoas', count: people.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full">
      {/* Header & Fully Responsive Mobile Action Buttons/Tabs Layout */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 w-full max-w-full">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Ecossistema</h1>
          <p className="text-sm text-white/40 max-w-lg">
            Navegue pela estrutura orgânica de Áreas, Projetos e Fontes que compõem o ecossistema ÉDEN.
          </p>
        </div>

        {/* Action buttons with custom horizontal mobile flex-scroll container */}
        <div className="flex flex-col gap-4 w-full xl:w-auto max-w-full min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar flex-nowrap w-full">
            <button 
              onClick={() => setSourceDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-3 bg-white/2 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-all shrink-0 whitespace-nowrap"
            >
              <Database size={12} className="text-emerald-400" /> Registrar Fonte
            </button>
            <button 
              onClick={() => setPersonDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-3 bg-white/2 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-all shrink-0 whitespace-nowrap"
            >
              <UserPlus size={12} className="text-amber-400" /> Registrar Pessoa
            </button>
          </div>

          <div className="w-full max-w-full overflow-x-auto pb-1 custom-scrollbar">
            <EcosystemTabs activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
          </div>
        </div>
      </div>

      {/* Search Bar & Reusable Advanced Filter Button */}
      <div className="flex items-center gap-3 mb-6 w-full max-w-full">
        <div className="flex-1 relative min-w-0">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <input 
            type="text"
            placeholder={`Buscar em ${activeTab}...`}
            className="w-full bg-white/2 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-white focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-white/10 truncate"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3.5 rounded-2xl border transition-all shrink-0 ${
            showFilters || Object.values(filters).some(v => v !== 'all')
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'bg-white/2 border-white/5 text-white/40 hover:bg-white/5'
          }`}
          title="Filtros Avançados"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Universal Expandable Filter Panel Component */}
      <UniversalFilterPanel 
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        availableAreas={areas}
        availableProjects={projects}
      />

      {/* Grid View */}
      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sintonizando Estruturas</p>
        </div>
      ) : error ? (
        <div className="py-40 flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-black text-white mb-2 uppercase tracking-tighter">Falha na Sintonização</h2>
          <p className="text-xs text-white/40 max-w-sm mb-6 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
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
        <div className="py-40 text-center border border-dashed border-white/5 rounded-3xl mt-4">
          <p className="text-white/20 italic text-xs">Nenhum resultado para sua busca ou filtros.</p>
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
        onSuccess={() => {}}
      />
      <PersonRequestDrawer 
        isOpen={personDrawerOpen}
        onClose={() => setPersonDrawerOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
