'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Hash, Layers, Share2, Users, 
  Target, AlertCircle, CheckSquare, Activity,
  Globe, Database, FileText, Layout, ArrowUpRight,
  User, Link as LinkIcon, RefreshCw, Clock, Shield
} from 'lucide-react';
import { areasService } from '../../services/areasService';
import { projectsService } from '../../services/projectsService';
import { tasksService } from '../../services/tasksService';
import { decisionsService } from '../../services/decisionsService';
import { inboxService } from '../../services/inboxService';
import { sourcesService } from '../../services/sourcesService';
import { eventsService } from '../../services/eventsService';
import { peopleService } from '../../services/peopleService';
import { getEntityTypeLabel } from '../../utils/translationHelpers';

export const EntityDetailDrawer = ({ 
  type, 
  id, 
  onClose,
  onNavigate 
}: { 
  type: 'area' | 'project' | 'source' | 'person' | null; 
  id: string | null; 
  onClose: () => void;
  onNavigate?: (type: any, id: string) => void;
}) => {
  const [data, setData] = React.useState<any>(null);
  const [relations, setRelations] = React.useState<any>({
    projects: [],
    tasks: [],
    decisions: [],
    inbox: [],
    sources: [],
    people: [],
    events: [],
    area: null,
    project: null,
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
          const [projs, tasks, decs, inb, srcs, evts, peps] = await Promise.all([
            projectsService.getByArea(entityId),
            tasksService.getByArea(entityId),
            decisionsService.getByArea(entityId),
            inboxService.getByArea(entityId),
            sourcesService.getByArea(entityId),
            eventsService.getByArea(entityId, 15),
            peopleService.getAll().then(res => res.filter(p => p.areaRef === entityId))
          ]);
          rels = { projects: projs, tasks, decisions: decs, inbox: inb, sources: srcs, events: evts, people: peps };
        } else if (entityType === 'project') {
          entityData = await projectsService.getById(entityId);
          const [tasks, decs, inb, srcs, evts, area, peps] = await Promise.all([
            tasksService.getByProject(entityId),
            decisionsService.getByProject(entityId),
            inboxService.getByProject(entityId),
            sourcesService.getByProject(entityId),
            eventsService.getByProject(entityId, 15),
            entityData?.areaRef ? areasService.getById(entityData.areaRef) : Promise.resolve(null),
            peopleService.getAll().then(res => res.filter(p => (p as any).projectRefs?.includes(entityId) || p.projectRef === entityId))
          ]);
          rels = { tasks, decisions: decs, inbox: inb, sources: srcs, events: evts, area, people: peps };
        } else if (entityType === 'source') {
          entityData = (await sourcesService.getAll()).find(s => s.id === entityId);
          if (entityData?.areaRef) {
            rels.area = await areasService.getById(entityData.areaRef);
          }
          if (entityData?.projectRef) {
            rels.project = await projectsService.getById(entityData.projectRef);
          }
        } else if (entityType === 'person') {
          entityData = (await peopleService.getAll()).find(p => p.id === entityId);
          if (entityData?.areaRef) {
            rels.area = await areasService.getById(entityData.areaRef);
          }
          if (entityData?.projectRef) {
            rels.project = await projectsService.getById(entityData.projectRef);
          }
        }

        setData(entityData);
        setRelations(rels);
      } catch (err) {
        console.error('Erro ao carregar detalhes da entidade no cache:', err);
      }
      setLoading(false);
    }
    load();
  }, [type, id]);

  if (!type || !id) return null;

  const safeDateStr = (dVal: any) => {
    if (!dVal) return 'N/A';
    try {
      if (typeof dVal.toDate === 'function') return dVal.toDate().toLocaleDateString();
      if (dVal.seconds) return new Date(dVal.seconds * 1000).toLocaleDateString();
      return new Date(dVal).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const renderSpecificDetails = () => {
    if (type === 'person') {
      return (
        <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-4 mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">Atributos do Stakeholder</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Role / Cargo</span>
              <span className="text-xs font-bold text-white/80 truncate block">{data.role || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Tipo de Relação</span>
              <span className="text-xs font-bold text-white/80 uppercase truncate block">{data.relationType || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Nível de Atenção</span>
              <span className={`text-xs font-bold uppercase tracking-wide block ${data.attentionLevel === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                {data.attentionLevel || 'medium'}
              </span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Origem / Canal</span>
              <span className="text-xs font-bold text-white/60 uppercase truncate block">{data.source || data.channel || 'OpenClaw'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Área Vinculada</span>
              <span className="text-xs font-bold text-blue-400 block truncate">{relations.area?.name || data.areaRef || 'Geral / Desvinculado'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Projeto(s)</span>
              <span className="text-xs font-bold text-emerald-400 block truncate">
                {relations.project?.name || data.projectRef || data.projectRefs?.join(', ') || 'Nenhum direto'}
              </span>
            </div>
          </div>

          {data.notes && (
            <div className="pt-3 border-t border-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Notas Estratégicas</span>
              <p className="text-xs text-white/60 leading-relaxed italic bg-white/2 p-3 rounded-xl border border-white/5">
                "{data.notes}"
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-white/30 text-[9px] font-mono">
            <span className="flex items-center gap-1">
              <Clock size={10} /> Criado: {safeDateStr(data.createdAt)}
            </span>
            <span>Atualizado: {safeDateStr(data.updatedAt)}</span>
          </div>
        </div>
      );
    }

    if (type === 'source') {
      return (
        <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-4 mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest text-purple-400">Atributos da Fonte</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Tipo de Conector</span>
              <span className="text-xs font-mono font-bold text-white/80 uppercase truncate block">{data.type || 'google_sheets'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Relevância</span>
              <span className="text-xs font-bold text-emerald-400 uppercase block">{data.relevance || 'high'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Modo de Sincronia</span>
              <span className="text-xs font-bold text-white/60 uppercase block">{data.syncMode || 'auto'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Papel / Missão</span>
              <span className="text-xs font-bold text-white/60 truncate block">{data.role || 'Repositório Base'}</span>
            </div>
          </div>

          {data.url && (
            <div className="pt-3 border-t border-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Endereço (Link)</span>
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:underline flex items-center gap-1.5 break-all">
                <LinkIcon size={12} className="shrink-0" />
                {data.url}
              </a>
            </div>
          )}

          <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Área Canônica</span>
              <span className="text-xs font-bold text-blue-400 block truncate">{relations.area?.name || data.areaRef || 'Desvinculada'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Projeto de Escopo</span>
              <span className="text-xs font-bold text-emerald-400 block truncate">{relations.project?.name || data.projectRef || 'Geral'}</span>
            </div>
          </div>

          {data.notes && (
            <div className="pt-3 border-t border-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Notas da Ingestão</span>
              <p className="text-xs text-white/60 italic bg-white/2 p-3 rounded-xl border border-white/5">
                "{data.notes}"
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-white/30 text-[9px] font-mono">
            <span className="flex items-center gap-1">
              <Clock size={10} /> Criado: {safeDateStr(data.createdAt)}
            </span>
            <span>Atualizado: {safeDateStr(data.updatedAt)}</span>
          </div>
        </div>
      );
    }

    if (type === 'project') {
      return (
        <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-4 mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">Atributos do Projeto</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Status</span>
              <span className="text-xs font-bold text-white/80 uppercase block">{data.status || 'active'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Estágio</span>
              <span className="text-xs font-bold text-white/60 uppercase block">{data.stage || 'execução'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Prioridade</span>
              <span className="text-xs font-bold text-emerald-400 uppercase block">{data.priority || 'high'}</span>
            </div>
          </div>
          {relations.area && (
            <div className="pt-3 border-t border-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Área de Domínio</span>
              <span className="text-xs font-bold text-blue-400 block truncate">{relations.area.name}</span>
            </div>
          )}
        </div>
      );
    }

    if (type === 'area') {
      return (
        <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-4 mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">Atributos da Área</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Status Operacional</span>
              <span className="text-xs font-bold text-white/80 uppercase block">{data.status || 'active'}</span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Prioridade Geral</span>
              <span className="text-xs font-bold text-blue-400 uppercase block">{data.priority || 'high'}</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-none w-full max-w-full">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto w-full max-w-full"
        />

        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl sm:max-w-xl md:max-w-2xl bg-[#020617] border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col custom-scrollbar shrink-0"
        >
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sintonizando Detalhes</p>
            </div>
          ) : data ? (
            <div className="p-6 md:p-8 w-full max-w-full min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 pb-2 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                   <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-blue-400 shrink-0">
                     {type === 'area' ? <Hash size={20} /> : type === 'project' ? <Layers size={20} /> : type === 'source' ? <Database size={20} /> : <User size={20} />}
                   </div>
                   <div className="min-w-0">
                     <p className="text-[9px] font-black uppercase tracking-widest text-white/20">{getEntityTypeLabel(type)}</p>
                     <h2 className="text-lg font-black text-white truncate">{data.name}</h2>
                   </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Enriched Specific Info Card */}
              {renderSpecificDetails()}

              {/* General Objective/Description */}
              {(data.description || data.objective) && (
                <div className="mb-8">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Objetivo Central / Descrição</p>
                  <p className="text-xs text-white/60 leading-relaxed bg-white/2 p-4 rounded-2xl border border-white/5 italic">
                    "{data.description || data.objective}"
                  </p>
                </div>
              )}

              {/* Sub-Entities & Relationships */}
              <div className="space-y-6">
                
                {/* Linked Area (for Projects) */}
                {type === 'project' && relations.area && (
                  <RelationGroup title="Área Vinculada" icon={Hash}>
                    <RelationItem 
                      label={relations.area.name} 
                      onClick={() => onNavigate?.('area', relations.area.id)}
                    />
                  </RelationGroup>
                )}

                {/* Linked People */}
                {relations.people?.length > 0 && (
                  <RelationGroup title="Stakeholders / Pessoas Vinculadas" count={relations.people.length} icon={Users}>
                    <div className="grid grid-cols-1 gap-2">
                      {relations.people.map((pep: any) => (
                        <RelationItem 
                          key={pep.id} 
                          label={pep.name} 
                          sublabel={pep.role || pep.relationType || 'Stakeholder'} 
                          onClick={() => onNavigate?.('person', pep.id)}
                        />
                      ))}
                    </div>
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
                          sublabel={`Estágio: ${p.stage || 'Operação'}`} 
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
                          sublabel={s.type || 'Conector Canônico'}
                          icon={Database}
                          onClick={() => onNavigate?.('source', s.id)}
                        />
                      ))}
                    </div>
                  </RelationGroup>
                )}

                {/* Tasks Materializadas via Request */}
                {relations.tasks?.length > 0 && (
                  <RelationGroup title="Tarefas Vinculadas (Materializadas)" count={relations.tasks.length} icon={CheckSquare}>
                    <div className="space-y-2">
                      {[...relations.tasks]
                        .sort((a: any, b: any) => {
                          // Abertas primeiro
                          const aOpen = a.status !== 'completed' && !a.archived ? 0 : 1;
                          const bOpen = b.status !== 'completed' && !b.archived ? 0 : 1;
                          return aOpen - bOpen;
                        })
                        .map((t: any) => {
                          const isCompleted = t.status === 'completed';
                          const isArchived = t.archived === true;
                          return (
                            <div 
                              key={t.id} 
                              className={`p-3.5 border rounded-2xl flex flex-col gap-1.5 transition-all ${
                                isCompleted 
                                  ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70' 
                                  : isArchived
                                  ? 'bg-white/2 border-white/5 opacity-40 line-through'
                                  : 'bg-white/2 border-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isCompleted ? 'bg-emerald-400' : isArchived ? 'bg-white/20' : 'bg-blue-400 animate-pulse'}`} />
                                  <span className="text-xs font-bold text-white/90 truncate block">{t.name || t.title}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${
                                    isCompleted ? 'bg-emerald-500/10 text-emerald-400' : t.priority === 'high' || t.priority === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-white/40'
                                  }`}>
                                    {t.status || 'new'}
                                  </span>
                                </div>
                              </div>

                              {(t.notes || t.description) && (
                                <p className="text-[10px] text-white/50 line-clamp-2 pl-4 italic font-sans">"{t.notes || t.description}"</p>
                              )}

                              {/* Label extra do projeto se o drawer for de Área */}
                              {type === 'area' && t.projectRef && (
                                <div className="pl-4 pt-0.5">
                                  <span className="px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-tight">
                                    Projeto: {t.projectRef}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[8px] font-mono text-white/30 pl-4 pt-1 border-t border-white/5 mt-1">
                                <span>ID: {t.id}</span>
                                {t.completedAt && <span>Concluída: {safeDateStr(t.completedAt)}</span>}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </RelationGroup>
                )}

                {/* Sinais do Barramento */}
                {relations.events?.length > 0 && (
                  <RelationGroup title="Sinais do Barramento (Eventos Recentes)" count={relations.events.length} icon={Activity}>
                    <div className="space-y-2">
                      {relations.events.map((evt: any) => (
                        <div key={evt.id} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white/80 truncate">{evt.payloadSummary || evt.title || evt.eventType}</span>
                            <span className="text-[8px] font-black text-blue-400 uppercase px-1.5 py-0.5 bg-blue-500/10 rounded shrink-0">{evt.eventType}</span>
                          </div>
                          <div className="flex items-center justify-between text-[8px] text-white/40">
                            <span>Origem: {evt.actor || 'OpenClaw'}</span>
                            <span>{safeDateStr(evt.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RelationGroup>
                )}

              </div>
            </div>
          ) : (
             <div className="p-12 text-center my-auto">
               <AlertCircle size={24} className="text-white/20 mx-auto mb-2" />
               <p className="text-white/30 text-xs font-bold">Estrutura sem registros de metadados no cache da sessão.</p>
               <p className="text-[10px] text-white/20 mt-1">Sintonize novamente ou verifique as permissões de acesso.</p>
             </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const RelationGroup = ({ title, count, icon: Icon, children }: any) => (
  <div className="w-full max-w-full min-w-0">
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={12} className="text-white/20 shrink-0" />
        <h5 className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate">{title}</h5>
      </div>
      {count !== undefined && <span className="text-[9px] font-bold text-white/20 shrink-0">{count}</span>}
    </div>
    {children}
  </div>
);

const RelationItem = ({ label, sublabel, icon: Icon, onClick }: any) => (
  <button 
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl text-left transition-all max-w-full min-w-0 ${
      onClick ? 'hover:bg-white/5 hover:border-white/10' : 'cursor-default'
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      {Icon && <Icon size={12} className="text-white/20 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white/80 truncate block">{label}</p>
        {sublabel && <p className="text-[8px] font-bold text-white/30 uppercase tracking-tight mt-0.5 truncate block">{sublabel}</p>}
      </div>
    </div>
    {onClick && <ArrowUpRight size={12} className="text-white/10 shrink-0 ml-2" />}
  </button>
);
