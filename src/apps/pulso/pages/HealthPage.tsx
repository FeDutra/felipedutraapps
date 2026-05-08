'use client';

import React from 'react';
import { 
  healthService, 
  syncJobsService, 
  pulsoService 
} from '../services/pulsoService';
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
  AlertTriangle, CheckCircle2 
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
    systemStatus: 'healthy' as 'healthy' | 'attention' | 'critical'
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [allAlerts, allLogs, allSyncs, dashboard] = await Promise.all([
        healthService.getAlerts(),
        healthService.getLogs(15),
        syncJobsService.getAll(),
        pulsoService.getDashboardState()
      ]);

      const openAlerts = allAlerts.filter(a => a.status === 'open');
      const failedSyncs = allSyncs.filter(s => s.status === 'failed');
      
      setAlerts(allAlerts);
      setLogs(allLogs);
      setSyncJobs(allSyncs);
      
      // Calculate Overall Status
      let status: any = 'healthy';
      if (openAlerts.some(a => a.severity === 'critical') || failedSyncs.length > 0) {
        status = 'critical';
      } else if (openAlerts.length > 0) {
        status = 'attention';
      }

      setStats({
        openAlerts: openAlerts.length,
        brokenRoutines: 0, // Will be updated in Metabolism or merged
        failedSyncs: failedSyncs.length,
        systemStatus: status
      });
    } catch (error) {
      console.error('Error loading health data:', error);
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

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sintonizando Integridade</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-black text-white">Health Center</h1>
            <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
              stats.systemStatus === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              stats.systemStatus === 'attention' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              {stats.systemStatus === 'healthy' ? 'SISTEMA SAUDÁVEL' : stats.systemStatus === 'attention' ? 'ATENÇÃO REQUERIDA' : 'ESTADO CRÍTICO'}
            </div>
          </div>
          <p className="text-sm text-white/40 max-w-lg">
            Monitoramento em tempo real da integridade técnica e operacional do ecossistema PULSO.
          </p>
        </div>
        <button 
          onClick={loadData}
          className="p-4 bg-white/2 border border-white/5 rounded-2xl text-white/40 hover:bg-white/5 transition-all flex items-center gap-2 text-xs font-bold"
        >
          <Activity size={16} />
          Atualizar Estado
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
          title="Firestore Online" 
          value="OK" 
          icon={Database} 
          status="healthy"
          colorClass="text-emerald-400"
        />
        <HealthStatusCard 
          title="Auth Security" 
          value="Ativo" 
          icon={ShieldCheck} 
          status="healthy"
          colorClass="text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Alerts & Syncs (Left) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Active Alerts */}
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <AlertCircle size={12} /> Alertas de Operação
              </h3>
              <span className="text-[10px] font-bold text-white/10 uppercase">{alerts.length} Total</span>
            </div>
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl">
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
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Wifi size={12} /> Sincronização de Fontes
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {syncJobs.map(job => (
                <SyncJobCard key={job.id} job={job} />
              ))}
            </div>
          </section>

        </div>

        {/* System Logs (Right) */}
        <div className="lg:col-span-4">
          <section className="bg-white/2 border border-white/5 rounded-3xl p-8 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Terminal size={12} /> Logs do Sistema
              </h3>
              <Clock size={14} className="text-white/10" />
            </div>
            
            <div className="space-y-6">
              {logs.map((log, idx) => (
                <div key={log.id} className="relative pl-6 pb-6 border-l border-white/5 last:pb-0">
                  <div className={`absolute left-[-5px] top-0 w-2 h-2 rounded-full ${
                    log.severity === 'critical' ? 'bg-red-500' : 
                    log.severity === 'high' ? 'bg-amber-500' : 
                    'bg-blue-500/40'
                  }`} />
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">{log.type}</span>
                    <span className="text-[8px] text-white/10">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-white/60 font-medium line-clamp-2">{log.event}</p>
                </div>
              ))}
            </div>

            <button className="w-full mt-8 py-3 bg-white/2 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:bg-white/5 transition-all">
              Ver Logs Completos
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
