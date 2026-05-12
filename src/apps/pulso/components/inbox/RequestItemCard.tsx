'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock, User, Layers, Tag, ChevronRight, AlertCircle, CheckCircle2, Loader2, MessageSquare, Mic, RefreshCw, Cpu, Layout } from 'lucide-react';
import { PulsoRequest } from '../../types/pulso.types';

interface RequestItemCardProps {
  request: PulsoRequest;
  onClick?: (request: PulsoRequest) => void;
}

export const RequestItemCard = ({ request, onClick }: RequestItemCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'accepted': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'running': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'needs_clarification': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  const getOriginIcon = (channel?: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare size={10} />;
      case 'voice': return <Mic size={10} />;
      case 'routine': return <RefreshCw size={10} />;
      case 'system': return <Cpu size={10} />;
      default: return <Layout size={10} />;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'create_agent': return <Zap size={14} />;
      case 'refresh_state': return <Clock size={14} />;
      case 'create_task': return <Layers size={14} />;
      default: return <Tag size={14} />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onClick?.(request)}
      className="group bg-white/2 border border-white/5 hover:border-white/10 p-6 rounded-3xl transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-6 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${getStatusColor(request.status)}`}>
              {request.status === 'running' && <Loader2 size={10} className="animate-spin" />}
              {request.status}
            </span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{request.requestType.replace('_', ' ')}</span>
            
            {request.origin?.channel && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-bold text-white/40 uppercase tracking-tight">
                {getOriginIcon(request.origin.channel)}
                {request.origin.channel}
              </span>
            )}
          </div>
          
          <h4 className="text-sm font-black text-white/90 mb-2 truncate group-hover:text-white transition-colors">{request.title}</h4>
          <p className="text-xs text-white/40 line-clamp-2 leading-relaxed mb-4">{request.summary}</p>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/20">
              <User size={12} />
              <span className="text-[10px] font-bold">{request.requestedBy}</span>
            </div>
            {request.areaRef && (
              <div className="flex items-center gap-1.5 text-blue-400/40">
                <Layers size={12} />
                <span className="text-[10px] font-bold uppercase tracking-tight">{request.areaRef}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-white/20">
              <Clock size={12} />
              <span className="text-[10px] font-bold">{new Date(request.requestedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-white/2 rounded-2xl text-white/20 group-hover:text-white group-hover:bg-blue-500/20 transition-all">
          <ChevronRight size={18} />
        </div>
      </div>
    </motion.div>
  );
};
