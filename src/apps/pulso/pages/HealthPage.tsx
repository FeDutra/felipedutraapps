'use client';

import React from 'react';
import { 
  healthService, 
  syncJobsService, 
  pulsoService,
  eventsService,
  requestsService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { AlertCircle as AlertCircleIcon } from 'lucide-react';
import { Alert, Log, SyncJob } from '../types/pulso.types';
import { 
  HealthStatusCard, 
  AlertItemRow, 
  SyncJobCard 
} from '../components/system/SystemCards';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, Activity, Server, ShieldCheck, 
  Clock, Database, Wifi, Globe, Terminal, 
  AlertTriangle, CheckCircle2, Zap 
} from 'lucide-react';

export default function HealthPage() {
  const [loading, setLoading] = React.useState(true);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [syncJobs, setSyncJobs] = React.useState<SyncJob[]>([]);
  const [stats, setStats] = React.useState({
    openAlerts: 0,
    brokenRoutines: 0,
    failedSyncs: 0,
    pendingEvents: 0,
    failedEvents: 0,
    systemStatus: 'healthy' as 'healthy' | 'attention' | 'critical'
  });
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      
      const [allAlerts, allLogs, allSyncs, allEvents, dashboard] = await Promise.all([
        healthService.getAlerts(),
        healthService.getLogs(15),
        syncJobsService.getAll(),
        eventsService.getRecent(100),
        pulsoService.getDashboardState()
      ]);

      const openAlerts = allAlerts.filter(a => a.status === 'open');
      const failedSyncs = allSyncs.filter(s => s.status === 'failed');
      const pendingEvents = allEvents.filter(e => e.outboxStatus === 'pending');
      const failedEvents = allEvents.filter(e => e.outboxStatus === 'failed');
      
      setAlerts(allAlerts);
      setLogs(allLogs);
      setSyncJobs(allSyncs);
      
      // Calculate Overall Status
      let status: any = 'healthy';
      if (openAlerts.some(a => a.severity === 'critical') || failedSyncs.length > 0 || failedEvents.length > 0) {
        status = 'critical';
      } else if (openAlerts.length > 0 || pendingEvents.length > 10) {
        status = 'attention';
      }

      setStats({
        openAlerts: openAlerts.length,
        brokenRoutines: 0, 
        failedSyncs: failedSyncs.length,
        pendingEvents: pendingEvents.length,
        failedEvents: failedEvents.length,
        systemStatus: status
      });
    } catch (err: any) {
      console.error('Error loading health data:', err);
      setError(err.message || 'Erro ao sintonizar integridade técnica.');
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAlertAction = async (id: string, action: string) => {
    if (action === 'acknowledge') await healthService.acknowledgeAlert(id);
    if (action === 'resolve') await healthService.resolveAlert(id);
    if (action === 'ignore') await healthService.ignoreAlert(id);
    loadData();
  };

  const handleRefreshState = async () => {
    try {
      await requestsService.createRequest({
        title: 'Verificação Manual de Integridade',
        requestType: 'system_health_check',
        priority: 'high',
        payload: {
          timestamp: new Date().toISOString(),
          requestedBy: 'user'
        }
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && itemsLengthCheck()) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-mono uppercase tracking-widest text-[9px]">Sintonizando Integridade</p>
      </div>
    );
  }

  function itemsLengthCheck() {
    return alerts.length === 0 && syncJobs.length === 0;
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircleIcon size={24} className="text-red-400 mb-4" />
        <h2 className="text-lg font-light text-white mb-2 uppercase tracking-wide">Falha na Sintonização</h2>
        <p className="text-xs text-white/40 max-w-sm mb-8 leading-relaxed font-light">{error}</p>
        <button 
          onClick={() => loadData()}
          className="text-white/50 hover:text-white transition-colors text-xs font-mono tracking-widest uppercase bg-transparent border-none cursor-pointer outline-none"
        >
          [ Tentar Novamente ]
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl font-light text-[#fbf9f5] tracking-wide">Saúde / Riscos</h1>
            <span className={`text-[8px] font-mono tracking-widest uppercase ${
              stats.systemStatus === 'healthy' ? 'text-emerald-400' :
              stats.systemStatus === 'attention' ? 'text-amber-400' :
              'text-red-500'
            }`}>
              {stats.systemStatus === 'healthy' ? '[ SISTEMA SAUDÁVEL ]' : stats.systemStatus === 'attention' ? '[ ATENÇÃO REQUERIDA ]' : '[ ESTADO CRÍTICO ]'}
            </span>
          </div>
          <p className="text-xs text-white/40 max-w-lg font-light">
            Monitoramento em tempo real da integridade técnica e operacional do ecossistema PULSO.
          </p>
        </div>
        <button 
          onClick={handleRefreshState}
          className="bg-transparent border-none text-white/40 hover:text-white transition-colors flex items-center gap-2 text-xs font-mono tracking-widest uppercase cursor-pointer"
        >
          <Activity size={14} strokeWidth={1} />
          Atualizar Estado
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 border-b border-white/5 pb-8">
        <HealthStatusCard 
          title="Alertas Abertos" 
          value={stats.openAlerts} 
          icon={AlertCircle} 
          status={stats.openAlerts > 0 ? 'attention' : 'healthy'}
          colorClass="text-red-500"
        />
        <HealthStatusCard 
          title="Sync Jobs Falhando" 
          value={stats.failedSyncs} 
          icon={Globe} 
          status={stats.failedSyncs > 0 ? 'critical' : 'healthy'}
          colorClass="text-amber-500"
        />
        <HealthStatusCard 
          title="Eventos Pendentes" 
          value={stats.pendingEvents} 
          icon={Activity} 
          status={stats.pendingEvents > 10 ? 'attention' : 'healthy'}
          colorClass="text-blue-400"
        />
        <HealthStatusCard 
          title="Falhas no Outbox" 
          value={stats.failedEvents} 
          icon={AlertTriangle} 
          status={stats.failedEvents > 0 ? 'critical' : 'healthy'}
          colorClass="text-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Alerts & Syncs (Left) */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* Active Alerts */}
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-[10px] font-mono tracking-widest uppercase text-white/30 flex items-center gap-2">
                <AlertCircle size={12} strokeWidth={1} /> Alertas de Operação
              </h3>
              <span className="text-[9px] font-mono text-white/15 uppercase">{alerts.length} Total</span>
            </div>
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="py-12 text-center border-b border-dashed border-white/5">
                  <p className="text-white/20 text-xs italic">Nenhum alerta ativo no momento.</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <AlertItemRow key={alert.id} alert={alert} onAction={handleAlertAction} />
                ))
              )}
            </div>
          </section>

          {/* Sync Jobs */}
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-[10px] font-mono tracking-widest uppercase text-white/30 flex items-center gap-2">
                <Wifi size={12} strokeWidth={1} /> Sincronização de Fontes
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {syncJobs.map(job => (
                <SyncJobCard key={job.id} job={job} />
              ))}
            </div>
          </section>

          {/* Outbox Integrity */}
          <section className="py-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-mono tracking-widest uppercase text-white/30 flex items-center gap-2">
                <Zap size={14} strokeWidth={1} /> Integridade do Outbox
              </h3>
              <span className="text-[9px] font-mono text-white/20 uppercase">Sincronia com OpenClaw</span>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
              <div className="flex-1 space-y-4 w-full">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[9px] font-mono text-white/20 uppercase">Fila de Eventos</span>
                  <span className="text-xs font-light text-white/60">{stats.pendingEvents} Pendentes</span>
                </div>
                <div className="w-full h-[1px] bg-white/5 overflow-hidden">
                  <div className="h-full bg-blue-500/50" style={{ width: `${Math.min(100, stats.pendingEvents * 10)}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center px-6 border-r border-white/5">
                  <p className="text-[8px] font-mono tracking-wider text-white/20 uppercase mb-1">Taxa de Sucesso</p>
                  <p className="text-xl font-light text-emerald-400">99.2%</p>
                </div>
                <div className="text-center px-6">
                  <p className="text-[8px] font-mono tracking-wider text-white/20 uppercase mb-1">Latência Média</p>
                  <p className="text-xl font-light text-white">450ms</p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* System Logs (Right) */}
        <div className="lg:col-span-4">
          <section className="py-4 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-mono tracking-widest uppercase text-white/30 flex items-center gap-2">
                <Terminal size={12} strokeWidth={1} /> Logs do Sistema
              </h3>
              <Clock size={14} strokeWidth={1} className="text-white/10" />
            </div>
            
            <div className="space-y-6">
              {logs.map((log, idx) => (
                <div key={log.id} className="relative pl-6 pb-6 border-l border-white/5 last:pb-0">
                  <div className={`absolute left-[-3px] top-1.5 w-1.5 h-1.5 rounded-full ${
                    log.severity === 'critical' ? 'bg-red-500' : 
                    log.severity === 'high' ? 'bg-amber-500' : 
                    'bg-blue-500/40'
                  }`} />
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono tracking-wider text-white/20 uppercase">{log.type}</span>
                    <span className="text-[8px] font-mono text-white/10">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-white/60 font-light line-clamp-2 leading-relaxed">{log.event}</p>
                </div>
              ))}
            </div>

            <button className="w-full mt-8 py-3 bg-transparent border-none text-[10px] font-mono tracking-widest uppercase text-white/20 hover:text-white/60 transition-all cursor-pointer">
              [ Ver Logs Completos ]
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
