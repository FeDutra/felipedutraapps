'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Hash, Layers, Share2, Users, 
  Target, AlertCircle, CheckSquare, Activity,
  Globe, Database, FileText, Layout, ArrowUpRight
} from 'lucide-react';
import { 
  areasService, 
  projectsService, 
  tasksService, 
  decisionsService, 
  inboxService,
  sourcesService
} from '../../services/pulsoService';
import { InboxTypeBadge } from '../inbox/InboxBadges';
import { PriorityBadge } from '../BaseComponents';
import { getStatusLabel } from '../../utils/statusHelpers';
import { getEntityTypeLabel, getInboxTypeLabel } from '../../utils/translationHelpers';

export const EntityDetailDrawer = ({ 
  type, 
  id, 
  onClose,
  onNavigate 
}: { 
  type: 'area' | 'project' | 'source' | 'person' | null, 
  id: string | null, 
  onClose: () => void,
  onNavigate?: (type: any, id: string) => void
}) => {
  const [data, setData] = React.useState<any>(null);
  const [relations, setRelations] = React.useState<any>({
    projects: [],
    tasks: [],
    decisions: [],
    inbox: [],
    sources: [],
    area: null
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id || !type) return;
    const entityId = id;
    const entityType = type;

    async function load() {
      setLoading(true);
      try {
        let entityData: any;
        let rels: any = {};

        if (entityType === 'area') {
          entityData = await areasService.getById(entityId);
          const [projs, tasks, decs, inb, srcs] = await Promise.all([
            projectsService.getByArea(entityId),
            tasksService.getByArea(entityId),
            decisionsService.getByArea(entityId),
            inboxService.getByArea(entityId),
            sourcesService.getByArea(entityId)
          ]);
          rels = { projects: projs, tasks, decisions: decs, inbox: inb, sources: srcs };
        } else if (entityType === 'project') {
          entityData = await projectsService.getById(entityId);
          const [tasks, decs, inb, srcs, area] = await Promise.all([
            tasksService.getByProject(entityId),
            decisionsService.getByProject(entityId),
            inboxService.getByProject(entityId),
            sourcesService.getByProject(entityId),
            entityData?.areaRef ? areasService.getById(entityData.areaRef) : Promise.resolve(null)
          ]);
          rels = { tasks, decisions: decs, inbox: inb, sources: srcs, area };
        } else if (entityType === 'source') {
          entityData = (await sourcesService.getAll()).find(s => s.id === entityId);
          // Simplified source relations for now
        }

        setData(entityData);
        setRelations(rels);
      } catch (err) {
        console.error('Erro ao carregar detalhes da entidade:', err);
      }
      setLoading(false);
    }
    load();
  }, [type, id]);

  if (!type || !id) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
        />

        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col"
        >
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sintonizando Detalhes</p>
            </div>
          ) : data ? (
            <div className="p-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-blue-400">
                     {type === 'area' ? <Hash size={24} /> : <Layers size={24} />}
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{getEntityTypeLabel(type)}</p>
                     <h2 className="text-2xl font-black text-white">{data.name}</h2>
                   </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Status & Priority Row */}
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/2 border border-white/5 p-4 rounded-2xl">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Status</p>
                   <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                     {getStatusLabel(data.status)}
                   </div>
                </div>
                <div className="bg-white/2 border border-white/5 p-4 rounded-2xl">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Prioridade</p>
                   <PriorityBadge priority={data.priority} />
                </div>
              </div>

              {/* Description */}
              <div className="mb-12">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Descrição / Objetivo</p>
                <p className="text-sm text-white/60 leading-relaxed bg-white/2 p-6 rounded-3xl border border-white/5 italic">
                  "{data.description || data.objective || 'Nenhuma descrição fornecida.'}"
                </p>
              </div>

              {/* RELATIONS SECTION */}
              <div className="space-y-10">
                
                {/* Linked Area (for Projects) */}
                {type === 'project' && relations.area && (
                  <RelationGroup title="Área Vinculada" icon={Hash}>
                    <RelationItem 
                      label={relations.area.name} 
                      onClick={() => onNavigate?.('area', relations.area.id)}
                    />
                  </RelationGroup>
                )}

                {/* Projects (for Areas) */}
                {relations.projects?.length > 0 && (
                  <RelationGroup title="Projetos Ativos" count={relations.projects.length} icon={Layers}>
                    <div className="grid grid-cols-1 gap-2">
                      {relations.projects.map((p: any) => (
                        <RelationItem 
                          key={p.id} 
                          label={p.name} 
                          sublabel={p.stage} 
                          onClick={() => onNavigate?.('project', p.id)}
                        />
                      ))}
                    </div>
                  </RelationGroup>
                )}

                {/* Sources */}
                {relations.sources?.length > 0 && (
                  <RelationGroup title="Fontes de Contexto" count={relations.sources.length} icon={Globe}>
                    <div className="grid grid-cols-1 gap-2">
                      {relations.sources.map((s: any) => (
                        <RelationItem 
                          key={s.id} 
                          label={s.name} 
                          sublabel={s.system}
                          icon={Database}
                        />
                      ))}
                    </div>
                  </RelationGroup>
                )}

                {/* Tasks & Records */}
                {(relations.tasks?.length > 0 || relations.decisions?.length > 0) && (
                  <RelationGroup title="Registros Vinculados" icon={Activity}>
                    <div className="space-y-4">
                      {relations.tasks.slice(0, 5).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                          <div className="flex items-center gap-3">
                            <CheckSquare size={14} className="text-emerald-400" />
                            <span className="text-xs text-white/60">{t.name}</span>
                          </div>
                          <span className="text-[8px] font-black text-emerald-500/40 uppercase">Task</span>
                        </div>
                      ))}
                      {relations.decisions.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Target size={14} className="text-blue-400" />
                            <span className="text-xs text-white/60">{d.name}</span>
                          </div>
                          <span className="text-[8px] font-black text-blue-500/40 uppercase">Decision</span>
                        </div>
                      ))}
                    </div>
                  </RelationGroup>
                )}

                {/* Related Inbox Items */}
                {relations.inbox?.length > 0 && (
                  <RelationGroup title="Inbox Relacionado" count={relations.inbox.length} icon={FileText}>
                    <div className="space-y-2">
                      {relations.inbox.slice(0, 5).map((i: any) => (
                        <div key={i.id} className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl group cursor-pointer hover:bg-amber-500/10 transition-colors">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-white/80">{i.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-amber-400/60 uppercase tracking-tight">{getInboxTypeLabel(i.type)}</span>
                                <InboxTypeBadge type={i.type} />
                              </div>
                           </div>
                          <p className="text-[10px] text-white/30 line-clamp-1">{i.body}</p>
                        </div>
                      ))}
                    </div>
                  </RelationGroup>
                )}

              </div>
            </div>
          ) : (
             <div className="p-10 text-center">
               <p className="text-white/20">Entidade não encontrada.</p>
             </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const RelationGroup = ({ title, count, icon: Icon, children }: any) => (
  <div>
    <div className="flex items-center justify-between mb-4 px-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-white/20" />
        <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">{title}</h5>
      </div>
      {count !== undefined && <span className="text-[10px] font-bold text-white/20">{count}</span>}
    </div>
    {children}
  </div>
);

const RelationItem = ({ label, sublabel, icon: Icon, onClick }: any) => (
  <button 
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl text-left transition-all ${
      onClick ? 'hover:bg-white/5 hover:border-white/10' : 'cursor-default'
    }`}
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon size={14} className="text-white/20" />}
      <div>
        <p className="text-xs font-bold text-white/80">{label}</p>
        {sublabel && <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter mt-0.5">{sublabel}</p>}
      </div>
    </div>
    {onClick && <ArrowUpRight size={14} className="text-white/10" />}
  </button>
);
