// migration-readiness-client.tsx
// CLIENT ISLAND — renders real migration readiness state. Steps, quality anomalies,
// recent imports and the readiness score come from the API (computed from the DB and
// the stored migration config). Task toggles, the mapping modal and the validation
// action persist via the real API — nothing is simulated.
'use client';

import React, { useState } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowRightLeft, Check, CheckCircle2, ChevronRight,
  Download, FileSpreadsheet, Info, Plus, RefreshCw, Sparkles, User, X,
} from 'lucide-react';
import { TARGET_COLUMNS } from '@/features/settings/data/migration-readiness-config';
import type {
  ColumnMapping,
  MigrationReadinessData,
  TaskItem,
} from '@/libs/services/migration-readiness';

type Props = {
  initialData: MigrationReadinessData | null;
  locale?: string;
};

function problemHref(locale: string | undefined, url: string): string {
  return locale ? `/${locale}${url}` : url;
}

export function MigrationReadinessClient({ initialData, locale }: Props) {
  const [data, setData] = useState<MigrationReadinessData | null>(initialData);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [draftMappings, setDraftMappings] = useState<ColumnMapping[]>([]);
  const [validating, setValidating] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/migration', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.data) setData(json.data);
      else triggerToast(json?.error?.message ?? 'Impossible de recharger les données.');
    } catch {
      triggerToast('Erreur réseau lors du rechargement.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerValidation() {
    setValidating(true);
    try {
      const res = await fetch('/api/settings/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validate: true }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
        triggerToast('Validation globale des données de migration terminée.');
      } else {
        triggerToast(json?.error?.message ?? 'Échec de la validation.');
      }
    } catch {
      triggerToast('Erreur réseau lors de la validation.');
    } finally {
      setValidating(false);
    }
  }

  async function handleToggleTask(task: TaskItem) {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    setData(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t)),
    } : prev);
    try {
      const res = await fetch(`/api/settings/migration/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(prev => prev ? {
          ...prev,
          tasks: prev.tasks.map(t => (t.id === task.id ? { ...t, status: task.status } : t)),
        } : prev);
        triggerToast(json?.error?.message ?? 'Échec de la mise à jour de la tâche.');
      }
    } catch {
      setData(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => (t.id === task.id ? { ...t, status: task.status } : t)),
      } : prev);
      triggerToast('Erreur réseau lors de la mise à jour de la tâche.');
    }
  }

  function openMappingModal() {
    setDraftMappings(data?.columnMappings.map(m => ({ ...m })) ?? []);
    setMappingModalOpen(true);
  }

  async function handleSaveMapping() {
    const cleaned = draftMappings
      .filter(m => m.sourceCol.trim().length > 0)
      .map(m => ({ sourceCol: m.sourceCol.trim(), targetField: m.targetField }));
    if (cleaned.length === 0) {
      triggerToast('Ajoutez au moins une colonne cartographiée.');
      return;
    }
    setSavingMappings(true);
    try {
      const res = await fetch('/api/settings/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnMappings: cleaned }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
        setMappingModalOpen(false);
        triggerToast(`Cartographie des champs enregistrée (${cleaned.length} colonnes).`);
      } else {
        triggerToast(json?.error?.message ?? "Échec de l'enregistrement du mapping.");
      }
    } catch {
      triggerToast("Erreur réseau lors de l'enregistrement du mapping.");
    } finally {
      setSavingMappings(false);
    }
  }

  if (!data) {
    return (
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 text-center shadow-2xs">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#111827]">
            Impossible de charger l'état de migration
          </h2>
          <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
            Connectez-vous à un compte administrateur d'établissement, puis réessayez.
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Rechargement...' : 'Réessayer'}
          </button>
        </div>
      </div>
    );
  }

  const stepsDone = data.steps.filter(s => s.status === 'done').length;
  const stepsLabel = stepsDone === data.steps.length
    ? 'Toutes les étapes terminées'
    : `Étape ${Math.min(stepsDone + 1, data.steps.length)} sur ${data.steps.length} en cours`;
  const mappedPct = data.totalColumnsCount > 0
    ? Math.round((data.mappedColumnsCount / data.totalColumnsCount) * 100)
    : 0;

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#111827] text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-[#4B6BFB]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Centre de Préparation à la Migration (PF-01)</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Audit de conformité, cartographie des champs Excel/MASSAR et validation avant injection PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/settings/migration/template"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#374151]
              bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
          >
            <Download className="w-4 h-4 text-[#4B6BFB]" />
            Télécharger le modèle Excel
          </a>
          <button
            onClick={handleTriggerValidation}
            disabled={validating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validation en cours...' : 'Lancer la validation globale'}
          </button>
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Score de préparation globale</p>
            <p className="text-2xl font-bold text-[#111827]">{data.readinessScore}%</p>
            <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden mt-1">
              <div className="bg-[#4B6BFB] h-full transition-all" style={{ width: `${data.readinessScore}%` }} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Fichiers source importés</p>
            <p className="text-2xl font-bold text-[#111827]">{data.fileCount} fichiers</p>
            <p className="text-[11px] font-semibold text-emerald-600">Excel / CSV MASSAR</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Enregistrements à migrer</p>
            <p className="text-2xl font-bold text-[#111827]">{data.entityCounts.students + data.entityCounts.guardians}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">
              {data.entityCounts.students} Élèves · {data.entityCounts.guardians} Tuteurs
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Colonnes cartographiées</p>
            <p className="text-2xl font-bold text-[#111827]">{data.mappedColumnsCount} / {data.totalColumnsCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{mappedPct}% des attributs cartographiés</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Actionable Priority Recommendation Banner ── */}
      {data.nextRecommendation && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-left ${
          data.nextRecommendation.type === 'warning'
            ? 'bg-amber-50/90 border border-amber-200 text-amber-900'
            : 'bg-blue-50/90 border border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-3">
            {data.nextRecommendation.type === 'warning'
              ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              : <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <div>
              <p className="text-xs font-bold">{data.nextRecommendation.title}</p>
              <p className="text-xs mt-0.5 opacity-90">{data.nextRecommendation.description}</p>
            </div>
          </div>
          <button
            onClick={openMappingModal}
            className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-current rounded-lg hover:opacity-80 shrink-0 transition-colors"
          >
            Cartographier les champs
          </button>
        </div>
      )}

      {/* ── Main Two-Area Bento Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Area (2 Cols): Migration Steps, Quality Anomalies, Recent Files ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Étapes de Préparation à la Migration */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h2 className="text-sm font-semibold text-[#111827]">Étapes de Préparation à la Migration</h2>
              <span className="text-xs text-[#6B7280]">{stepsLabel}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.steps.map(s => (
                <div key={s.id} className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#4B6BFB]">Étape {s.stepNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'done'
                          ? 'bg-emerald-50 text-emerald-700'
                          : s.status === 'in_progress'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.status === 'done' ? 'Terminé' : s.status === 'in_progress' ? 'En cours' : 'En attente'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#111827]">{s.label}</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{s.sub}</p>
                  </div>

                  {s.status === 'in_progress' && (
                    <button
                      onClick={openMappingModal}
                      className="mt-2 w-full py-1.5 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <span>Configurer le mapping</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Alertes de Qualité des Données Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-semibold text-[#111827]">Anomalies &amp; Problèmes de Qualité</h3>
              <span className="text-xs text-[#6B7280]">{data.qualityProblems.length} anomalies détectées</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-3 px-4">Problème Détecté</th>
                    <th className="py-3 px-4 text-center">Fiches Affectées</th>
                    <th className="py-3 px-4">Sévérité</th>
                    <th className="py-3 px-4 text-right">Action Recommandée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                  {data.qualityProblems.map(prob => (
                    <tr key={prob.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3.5 px-4 font-bold text-[#111827]">{prob.label}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#111827]">
                        {prob.recordCount}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          prob.severity === 'danger'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {prob.severity === 'danger' ? 'Critique' : 'Avertissement'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={problemHref(locale, prob.actionUrl)}
                          className="inline-block px-2.5 py-1 text-[11px] font-semibold text-[#4B6BFB] bg-[#F0F4FF] hover:bg-[#E0E9FF] rounded-lg transition-colors"
                        >
                          {prob.actionLabel}
                        </a>
                      </td>
                    </tr>
                  ))}
                  {data.qualityProblems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#6B7280]">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        Toutes les anomalies ont été résolues avec succès !
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fichiers Récents d'Importation */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Fichiers Source Téléchargés</h3>
              <span className="text-xs text-[#6B7280]">{data.recentFiles.length} fichiers récents</span>
            </div>

            {data.recentFiles.length > 0 ? (
              <div className="space-y-3">
                {data.recentFiles.map(file => (
                  <div key={file.id} className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center font-bold">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-[#111827]">{file.name}</p>
                        <p className="text-[11px] text-[#6B7280]">
                          {file.size} · Importé par <span className="font-semibold">{file.author}</span> · {file.time}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {file.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#6B7280]">
                <FileSpreadsheet className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs">
                  Aucun fichier source importé pour le moment.
                </p>
                <p className="text-[11px] mt-0.5">
                  Téléchargez le modèle Excel ci-dessus pour commencer.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* ── Right Area (1 Col): Team Tasks & Error Distribution ── */}
        <div className="flex flex-col gap-6">

          {/* Suivi des Tâches d'Équipe */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Suivi des Tâches d'Équipe</h3>
              <span className="text-xs text-[#6B7280]">{data.tasks.filter(t => t.status === 'done').length}/{data.tasks.length} complétées</span>
            </div>

            {data.tasks.length > 0 ? (
              <div className="space-y-3 text-xs">
                {data.tasks.map(t => (
                  <div key={t.id} className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTask(t)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        t.status === 'done'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-[#D1D5DB] bg-white hover:border-[#4B6BFB]'
                      }`}
                    >
                      {t.status === 'done' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <div className="space-y-1 flex-1">
                      <p className={`font-semibold ${t.status === 'done' ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'}`}>
                        {t.task}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                        <span>{t.assignee || 'Non assigné'}</span>
                        <span>{t.date || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#6B7280]">
                <p className="text-xs">Aucune tâche d'équipe définie.</p>
              </div>
            )}
          </div>

          {/* Distribution des Erreurs */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Distribution des Erreurs</h3>
              <span className="text-xs text-[#6B7280]">{data.totalErrors} anomalies totales</span>
            </div>

            {data.errorDistribution.length > 0 ? (
              <div className="space-y-3 text-xs">
                {data.errorDistribution.map((err, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#374151]">{err.name}</span>
                      <span className="font-mono text-[#111827]">{err.count} ({err.pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${err.pct}%`, backgroundColor: err.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#6B7280]">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs">Aucune anomalie détectée — les données sont propres.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Modal: Cartographie des Champs (Mapping) ── */}
      {mappingModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#111827]">Cartographie des Champs Excel -&gt; SchoolOS</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Associez chaque colonne de votre fichier Excel aux champs de la DB.</p>
              </div>
              <button onClick={() => setMappingModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[50vh] overflow-y-auto">
              {draftMappings.map((m, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
                  <input
                    value={m.sourceCol}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftMappings(prev => prev.map((item, i) => i === idx ? { ...item, sourceCol: v } : item));
                    }}
                    placeholder="Nom de la colonne source"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-[#111827] font-mono font-bold outline-none"
                  />
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  <select
                    value={m.targetField}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftMappings(prev => prev.map((item, i) => i === idx ? { ...item, targetField: v } : item));
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-[#111827] outline-none"
                  >
                    {TARGET_COLUMNS.map(col => (
                      <option key={col.key} value={col.key}>{col.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setDraftMappings(prev => prev.filter((_, i) => i !== idx))}
                    className="text-[#9CA3AF] hover:text-red-500 shrink-0"
                    aria-label="Supprimer la colonne"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setDraftMappings(prev => [
                  ...prev,
                  { sourceCol: '', targetField: TARGET_COLUMNS[0]?.key ?? '' },
                ])}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#4B6BFB] bg-[#F0F4FF] hover:bg-[#E0E9FF] rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une colonne
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F4F6]">
              <button
                onClick={() => setMappingModalOpen(false)}
                className="px-4 py-2 font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl text-xs"
              >
                Fermer
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={savingMappings}
                className="px-4 py-2 font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl text-xs shadow-xs disabled:opacity-60"
              >
                {savingMappings ? 'Enregistrement...' : 'Enregistrer le Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
