'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Hash, Layers, Share2, Users, ArrowRight, 
  Target, AlertCircle, CheckSquare, Activity,
  Globe, Database, FileText, Layout
} from 'lucide-react';
import { Area, Project, Source, Person } from '../../types/pulso.types';
import { PriorityBadge } from '../BaseComponents';

// --- AREA CARD ---
export const AreaCard = ({ area, stats, onClick }: { area: Area, stats?: any, onClick: () => void }) => {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
      onClick={onClick}
      className="p-6 bg-white/2 border border-white/5 rounded-3xl cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:border-blue-500/30 transition-colors">
          <Hash size={20} className="text-blue-400" />
        </div>
        <PriorityBadge priority={area.priority} />
      </div>
      
      <h3 className="text-lg font-black text-white mb-2 group-hover:text-blue-400 transition-colors">{area.name}</h3>
      <p className="text-xs text-white/40 line-clamp-2 mb-6 leading-relaxed">{area.description}</p>
      
      <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-6">
        <div className="text-center">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1">Projetos</p>
          <p className="text-sm font-bold text-white">{stats?.projectsCount || 0}</p>
        </div>
        <div className="text-center border-x border-white/5">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1">Pendente</p>
          <p className="text-sm font-bold text-amber-400">{stats?.pendingInboxCount || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1">Alertas</p>
          <p className="text-sm font-bold text-red-500">{stats?.alertsCount || 0}</p>
        </div>
      </div>
    </motion.div>
  );
};

// --- PROJECT CARD ---
export const ProjectCard = ({ project, onClick }: { project: Project, onClick: () => void }) => {
  const stageLabels: any = {
    'seed': 'Semente',
    'front': 'Front',
    'project': 'Projeto',
    'operation': 'Operação',
    'maintenance': 'Manutenção'
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
      onClick={onClick}
      className="p-6 bg-white/2 border border-white/5 rounded-3xl cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Layers size={16} className="text-blue-400" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20">{stageLabels[project.stage] || project.stage}</span>
        </div>
        <PriorityBadge priority={project.priority} />
      </div>

      <h3 className="text-base font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{project.name}</h3>
      <p className="text-xs text-white/40 line-clamp-2 mb-6 leading-relaxed">{project.objective}</p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
             <Target size={12} className="text-white/20" />
             <span className="text-[10px] font-bold text-white/40">{project.areaRef?.replace('area_', '') || 'N/A'}</span>
          </div>
        </div>
        <ArrowRight size={14} className="text-white/10 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
      </div>
    </motion.div>
  );
};

// --- SOURCE CARD ---
export const SourceCard = ({ source, onClick }: { source: Source, onClick: () => void }) => {
  const getIcon = (type: string) => {
    switch(type) {
      case 'google_sheet': return Database;
      case 'google_doc': return FileText;
      case 'notion_database': return Layout;
      default: return Globe;
    }
  };
  const Icon = getIcon(source.type);

  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
      onClick={onClick}
      className="p-5 bg-white/2 border border-white/5 rounded-2xl cursor-pointer transition-all group flex items-center gap-4"
    >
      <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{source.name}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{source.system}</span>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <span className="text-[9px] font-bold text-white/40">{source.syncMode}</span>
        </div>
      </div>
      <Share2 size={14} className="text-white/10 group-hover:text-white/40" />
    </motion.div>
  );
};

// --- PERSON CARD ---
export const PersonCard = ({ person, onClick }: { person: Person, onClick: () => void }) => {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
      onClick={onClick}
      className="p-4 bg-white/2 border border-white/5 rounded-2xl cursor-pointer transition-all group flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
        <Users size={18} className="text-white/40" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-white">{person.name}</h4>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-tight">{person.role}</p>
      </div>
      <ArrowRight size={14} className="text-white/5 group-hover:text-white/20" />
    </motion.div>
  );
};
