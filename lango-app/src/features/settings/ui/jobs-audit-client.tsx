// jobs-audit-client.tsx
// CLIENT ISLAND — owns jobs table, incident retries, manual job execution modal, and audit log exports.
'use client';

import React, { useState, useTransition } from 'react';
import {
  Clock, History, Play, CheckCircle2, AlertTriangle, Download,
  Cpu, Activity, AlertCircle, X, Calendar,
} from 'lucide-react';

export type JobItem = {
  id: string;
  name: string;
  category: string;
  schedule: string;
  nextRun: string;
  avgDuration: string;
  status: 'success' | 'paused' | 'error' | 'running';
  lastRun: string;
  lastMessage: string;
  action: string;
};

export type AuditLogItem = {
  id: string;
  user: string;
  action: string;
  module: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
};

export type HealthMetricItem = {
  id: string;
  name: string;
  value: string;
  note: string;
  status: 'healthy' | 'warning';
};

export type MaintenanceWindowItem = {
  title: string;
  schedule: string;
  impact: string;
};

type Props = {
  initialJobs: JobItem[];
  initialAudits: AuditLogItem[];
  initialHealthMetrics: HealthMetricItem[];
  initialMaintenanceWindows: MaintenanceWindowItem[];
  initialQueuedSms: number;
};

export function JobsAuditClient({
  initialJobs,
  initialAudits,
  initialHealthMetrics,
  initialMaintenanceWindows,
  initialQueuedSms,
}: Props) {
  const [jobs, setJobs] = useState<JobItem[]>(initialJobs);
  const [audits, setAudits] = useState<AuditLogItem[]>(initialAudits);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedJobToRun, setSelectedJobToRun] = useState<string>('job-1');
  const [incidentResolved, setIncidentResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleTriggerJob(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/jobs/${id}/trigger`, { method: 'POST' });
        const payload = await res.json();
        if (payload.job) {
          setJobs(prev => prev.map(j => (j.id === id ? payload.job : j)));
        }
        if (payload.auditItem) {
          setAudits(prev => [payload.auditItem, ...prev].slice(0, 50));
        }
      } catch {
        setJobs(prev => prev.map(j =>
          j.id === id
            ? { ...j, status: 'error' as const, lastMessage: "Erreur réseau : la tâche n'a pas pu être lancée." }
            : j,
        ));
      }
    });
  }

  function handleExportAudit() {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'ID,User,Action,Module,Severity,Timestamp\n' +
      audits.map(a => `"${a.id}","${a.user}","${a.action}","${a.module}","${a.severity}","${a.timestamp}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `journal_audit_schoolos_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const activeJobsCount = jobs.filter(j => j.status === 'success' || j.status === 'running').length;
  const errorJobsCount = jobs.filter(j => j.status === 'error').length;
  const successJobsCount = jobs.filter(j => j.status === 'success').length;
  const executedJobsCount = successJobsCount + errorJobsCount;
  const successRate = executedJobsCount > 0 ? Math.round((successJobsCount / executedJobsCount) * 100) : null;
  const errorJob = jobs.find(j => j.status === 'error') ?? null;

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Tâches Planifiées &amp; Journal d'Audit</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Automatisation des pings d'arrière-plan, santé de l'infrastructure et traçabilité opérationnelle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAudit}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#374151]
              bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
          >
            <Download className="w-4 h-4 text-[#4B6BFB]" />
            Exporter l'audit (CSV)
          </button>
          <button
            onClick={() => setRunModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Exécuter un job
          </button>
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Jobs automatisés actifs</p>
            <p className="text-2xl font-bold text-[#111827]">{activeJobsCount} / {jobs.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Automatisations système</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Taux d'exécution réussie</p>
            <p className="text-2xl font-bold text-[#111827]">{successRate === null ? '—' : `${successRate}%`}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">
              {executedJobsCount > 0 ? `${executedJobsCount} exécution(s) enregistrée(s)` : 'Aucune exécution enregistrée'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">SMS en attente d'envoi</p>
            <p className="text-2xl font-bold text-[#111827]">{initialQueuedSms}</p>
            <p className="text-[11px] font-semibold text-purple-600">Messages non encore envoyés</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Incidents ouverts</p>
            <p className="text-2xl font-bold text-[#111827]">{incidentResolved ? 0 : errorJobsCount}</p>
            <p className={`text-[11px] font-semibold ${incidentResolved || errorJobsCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {incidentResolved || errorJobsCount === 0 ? 'Aucun incident' : '1 alerte requérant attention'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${incidentResolved || errorJobsCount === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Open Incident Warning Banner ── */}
      {!incidentResolved && errorJob && (
        <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-amber-900">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Échec de la tâche : {errorJob.name}</p>
              <p className="text-xs mt-0.5 opacity-90">
                {errorJob.lastMessage || "La dernière exécution a rencontré une erreur."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleTriggerJob(errorJob.id);
              setIncidentResolved(true);
            }}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg hover:bg-amber-100/50 shrink-0 transition-colors"
          >
            Relancer la tâche
          </button>
        </div>
      )}

      {/* ── Main Two-Area Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Area (2 Cols): Scheduled Jobs Table & Operational Audit Stream ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Scheduled Background Jobs Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4B6BFB]" />
                <h2 className="text-sm font-semibold text-[#111827]">Tâches Planifiées (Automatisations d'Arrière-plan)</h2>
              </div>
              <span className="text-xs text-[#6B7280]">{jobs.length} tâches configurées</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-3 px-4">Tâche / Description</th>
                    <th className="py-3 px-4">Fréquence</th>
                    <th className="py-3 px-4">Prochaine Exécution</th>
                    <th className="py-3 px-4 text-center">Durée</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#111827]">{j.name}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 font-mono">{j.lastMessage}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[#374151] font-medium">{j.schedule}</td>
                      <td className="py-3.5 px-4 text-[#6B7280] font-mono text-[11px]">{j.nextRun}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-[11px]">{j.avgDuration}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          j.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : j.status === 'error'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            j.status === 'success' ? 'bg-emerald-500' : j.status === 'error' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                          {j.status === 'success' ? 'Succès' : j.status === 'error' ? 'Erreur' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTriggerJob(j.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-[#F0F4FF] text-[#4B6BFB] transition-colors"
                          title="Lancer la tâche maintenant"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Audit Log Stream */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">Journal d'Audit Opérationnel Récent</h3>
              </div>
              <span className="text-xs text-[#6B7280]">Traçabilité système</span>
            </div>

            <div className="space-y-3">
              {audits.length === 0 && (
                <p className="text-xs text-[#6B7280] py-4 text-center">
                  Aucun événement d'audit enregistré pour le moment.
                </p>
              )}
              {audits.map(aud => (
                <div key={aud.id} className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#111827]">{aud.action}</p>
                    <p className="text-[11px] text-[#6B7280]">
                      Effectué par <span className="font-bold text-[#374151]">{aud.user}</span> · {aud.timestamp}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    aud.severity === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : aud.severity === 'warning'
                      ? 'bg-amber-50 text-amber-700'
                      : aud.severity === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {aud.module}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right Area (1 Col): System Telemetry & Maintenance Schedule ── */}
        <div className="flex flex-col gap-6">

          {/* System Health Telemetry */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <Activity className="w-4 h-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">Santé Opérationnelle Système</h3>
            </div>

            <div className="space-y-3">
              {initialHealthMetrics.map(metric => (
                <div key={metric.id} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#374151]">{metric.name}</span>
                    <span className="font-mono font-bold text-[#111827]">{metric.value}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#6B7280]">{metric.note}</span>
                    <span className={`font-bold ${metric.status === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {metric.status === 'healthy' ? 'Sano' : 'Attention'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Windows Schedule */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <Calendar className="w-4 h-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">Fenêtres de Maintenance Planifiées</h3>
            </div>

            <div className="space-y-3 text-xs">
              {initialMaintenanceWindows.map((win, idx) => (
                <div key={idx} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
                  <p className="font-bold text-[#111827]">{win.title}</p>
                  <p className="text-[11px] font-mono text-[#4B6BFB]">{win.schedule}</p>
                  <p className="text-[11px] text-[#6B7280]">Impact : {win.impact}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── Modal: Lancer un Job ── */}
      {runModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">Lancer une tâche d'arrière-plan</h3>
              <button onClick={() => setRunModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTriggerJob(selectedJobToRun);
                setRunModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[#374151]">Sélectionnez la tâche à exécuter *</label>
                <select
                  value={selectedJobToRun}
                  onChange={e => setSelectedJobToRun(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                >
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.name} ({j.category})</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
                <p className="font-bold text-[#111827]">Mode d'exécution : Immédiat</p>
                <p className="text-[11px] text-[#6B7280]">
                  La tâche sera exécutée immédiatement. Un événement d'audit sera enregistré.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRunModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Démarrer l'exécution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
