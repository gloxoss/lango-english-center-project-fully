'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Video, Play, Square, XCircle, RefreshCw, Download, Paperclip,
  Users, ListChecks, AlertTriangle, Clock, ExternalLink, Trash2, Plus, CircleCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getSessionDetail, getAttendance, getRecordings, getMaterials, joinSession, redeemJoin,
  startSession, endSession, cancelSession, reconcileAttendance, postAttendance,
  syncRecordings, deleteRecording, attachMaterial, detachMaterial, errorMessage,
} from '../data/api';

const STATUS_STYLES: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal'; label: string }> = {
  draft: { variant: 'neutral', label: 'Brouillon' },
  scheduled: { variant: 'info', label: 'Planifiée' },
  waiting: { variant: 'warning', label: 'Salle prête' },
  live: { variant: 'success', label: 'En direct' },
  ended: { variant: 'neutral', label: 'Terminée' },
  cancelled: { variant: 'danger', label: 'Annulée' },
  failed: { variant: 'danger', label: 'Échec' },
  expired: { variant: 'neutral', label: 'Expirée' },
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'Présent', late: 'En retard', early: 'En avance', absent: 'Absent', unknown: 'Inconnu',
};
const RECON_LABELS: Record<string, string> = {
  pending: 'En attente', proposed: 'Proposé', approved: 'Approuvé', rejected: 'Rejeté', posted: 'Reporté',
};

export function SessionDetailClient({ sessionId, locale }: { sessionId: string; locale: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getSessionDetail>> | null>(null);
  const [attendance, setAttendance] = useState<Awaited<ReturnType<typeof getAttendance>> | null>(null);
  const [recordings, setRecordings] = useState<Awaited<ReturnType<typeof getRecordings>> | null>(null);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof getMaterials>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [reconcileNote, setReconcileNote] = useState('');
  const [newAssetId, setNewAssetId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a, r, m] = await Promise.all([
        getSessionDetail(sessionId), getAttendance(sessionId), getRecordings(sessionId), getMaterials(sessionId),
      ]);
      setDetail(d);
      setAttendance(a);
      setRecordings(r);
      setMaterials(m);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    setBusy('join');
    setError(null);
    setNotice(null);
    try {
      const grant = await joinSession(sessionId);
      const redeemed = await redeemJoin(sessionId, grant.token);
      setJoinUrl(redeemed.url);
      setNotice(`Jeton de connexion émis (${redeemed.role === 'moderator' ? 'modérateur' : 'participant'}), valide ${redeemed.providerType === 'dev' ? '(fournisseur de développement)' : ''}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm font-semibold text-slate-400">Chargement de la session…</div>;
  }

  if (error && !detail) {
    return (
      <div className="max-w-[1200px] mx-auto p-6 space-y-6">
        <Link href={`/${locale}/dashboard/academics/live-class`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2487B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux sessions
        </Link>
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      </div>
    );
  }

  const s = detail!.session;
  const st = STATUS_STYLES[s.status] ?? { variant: 'neutral', label: s.status };
  const canHost = s.status === 'scheduled' || s.status === 'waiting' || s.status === 'live';
  const isLive = s.status === 'live';
  const policy = (s.policy ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Back + title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard/academics/live-class`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2487B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
            <ArrowLeft className="w-3.5 h-3.5" /> Sessions
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
              <Video className="w-6 h-6 text-[#2487B8]" /> {s.title}
              <Badge variant={st.variant}>{st.label}</Badge>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {detail!.className ?? 'Classe'} · {detail!.sectionName ?? ''} · {detail!.subjectName ?? 'Matière'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => run('refresh', loadAll, 'Données actualisées.')} disabled={busy !== null}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          {isLive && (
            <button onClick={() => run('end', () => endSession(sessionId), 'Session terminée.')} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <Square className="h-3.5 w-3.5" /> Terminer
            </button>
          )}
          {canHost && !isLive && (
            <button onClick={() => run('start', () => startSession(sessionId), 'Session démarrée.')} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <Play className="h-3.5 w-3.5" /> Démarrer
            </button>
          )}
          {(s.status === 'scheduled' || s.status === 'waiting' || s.status === 'draft') && (
            <button onClick={() => run('cancel', () => cancelSession(sessionId), 'Session annulée.')} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <XCircle className="h-3.5 w-3.5" /> Annuler
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
          <CircleCheck className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Join panel */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-[#2487B8]" /> Connexion à la session
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {detail!.providerType === 'dev'
                ? 'Fournisseur de développement : jeton court, lien non productif.'
                : `Fournisseur : ${detail!.profileName ?? detail!.providerType}`}
            </p>
          </div>
          <button onClick={handleJoin} disabled={busy === 'join' || !canHost}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
            <Video className="h-3.5 w-3.5" /> {busy === 'join' ? 'Génération…' : 'Rejoindre la session'}
          </button>
        </div>
        {joinUrl && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500">Lien de développement (jamais un lien de production) :</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 break-all">{joinUrl}</code>
              <a href={joinUrl} target="_blank" rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                Ouvrir
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]"><Clock className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Planifié</p>
            <p className="text-sm font-extrabold text-[#16212B]">{new Date(s.scheduledStart).toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-slate-500">{new Date(s.scheduledEnd).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]"><Users className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Enseignant</p>
            <p className="text-sm font-extrabold text-[#16212B]">{detail!.teacherName ?? '—'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700"><ListChecks className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Politique</p>
            <p className="text-xs font-bold text-[#16212B]">
              {policy.recordingEnabled ? 'Enregistrement actif' : 'Enregistrement désactivé'}
              {policy.waitingRoom ? ' · Salle d\'attente' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance + Reconcile */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#2487B8]" /> Présences (réconciliation)
          </h2>
          <div className="flex items-center gap-2">
            <input value={reconcileNote} onChange={e => setReconcileNote(e.target.value)} placeholder="Raison (requise si manuel)…"
              className="h-8 w-56 rounded-lg border border-slate-200 px-2 text-[11px] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20" />
            <button onClick={() => run('reconcile', () => reconcileAttendance(sessionId, { note: reconcileNote }), 'Réconciliation proposée.')} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2.5 text-[11px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <RefreshCw className="h-3 w-3" /> Réconcilier
            </button>
            <button onClick={() => run('post', () => postAttendance(sessionId, reconcileNote), 'Présences reportées au registre.')} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <Download className="h-3 w-3" /> Reporter au registre
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4">Élève</th>
                <th className="py-2.5 px-3 text-center">Statut</th>
                <th className="py-2.5 px-3 text-right">Présence</th>
                <th className="py-2.5 px-3 text-right">Reconnexions</th>
                <th className="py-2.5 px-3 text-center">Réconciliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(attendance ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-xs font-semibold text-slate-400">Aucune présence dérivée. Démarrez la session et réconciliez après la fin.</td></tr>
              ) : (
                attendance!.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px]">{a.userName ?? a.userId}</td>
                    <td className="py-2.5 px-3 text-center"><Badge variant="info">{ATTENDANCE_LABELS[a.status] ?? a.status}</Badge></td>
                    <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                      {Math.round(a.totalPresenceSeconds / 60)} min
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{a.reconnectCount}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={a.reconciliationState === 'posted' ? 'success' : a.reconciliationState === 'proposed' ? 'warning' : 'neutral'}>
                        {RECON_LABELS[a.reconciliationState] ?? a.reconciliationState}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recordings */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Download className="w-4 h-4 text-[#2487B8]" /> Enregistrements
          </h2>
          <button onClick={() => run('syncRec', () => syncRecordings(sessionId), 'Enregistrements synchronisés.')} disabled={busy !== null}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
            <RefreshCw className="h-3 w-3" /> Synchroniser
          </button>
        </div>
        <div className="p-4">
          {(recordings ?? []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 text-center py-4">
              Aucun enregistrement. La politique de cette session est {policy.recordingEnabled ? 'activée' : 'désactivée'}.
            </p>
          ) : (
            <div className="space-y-2">
              {recordings!.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-bold text-[#16212B]">{r.providerRecordingId ?? 'Enregistrement'}</p>
                    <p className="text-[10px] text-slate-500">
                      {r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min · ` : ''}
                      {r.expiresAt ? `expire le ${new Date(r.expiresAt).toLocaleDateString('fr-FR')}` : 'rétention illimitée'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.state === 'ready' ? 'success' : r.state === 'processing' ? 'warning' : 'danger'}>{r.state}</Badge>
                    {r.playbackUrl && (
                      <a href={r.playbackUrl} target="_blank" rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2 text-[10px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                        <ExternalLink className="w-3 h-3" /> Lecture
                      </a>
                    )}
                    <button onClick={() => run(`del${r.id}`, () => deleteRecording(sessionId, r.id), 'Enregistrement supprimé.')} disabled={busy !== null}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-rose-200 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Materials */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-[#2487B8]" /> Ressources partagées
          </h2>
          <div className="flex items-center gap-2">
            <input value={newAssetId} onChange={e => setNewAssetId(e.target.value)} placeholder="ID de la ressource (Attachments Book)…"
              className="h-8 w-64 rounded-lg border border-slate-200 px-2 text-[11px] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20" />
            <button onClick={() => run('attach', () => attachMaterial(sessionId, newAssetId), 'Ressource liée.')} disabled={busy !== null || !newAssetId.trim()}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2.5 text-[11px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <Plus className="h-3 w-3" /> Lier
            </button>
          </div>
        </div>
        <div className="p-4">
          {(materials ?? []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 text-center py-4">Aucune ressource partagée.</p>
          ) : (
            <div className="space-y-2">
              {materials!.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-bold text-[#16212B]">{m.title}</p>
                    <p className="text-[10px] text-slate-500">Ressource {m.status}</p>
                  </div>
                  <button onClick={() => run(`detach${m.assetId}`, () => detachMaterial(sessionId, m.assetId), 'Ressource déliée.')} disabled={busy !== null}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-rose-200 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                    <Trash2 className="w-3 h-3" /> Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invitations */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#2487B8]" /> Roster & invitations ({detail!.invitations.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4">Utilisateur</th>
                <th className="py-2.5 px-3">Rôle</th>
                <th className="py-2.5 px-3 text-center">Éligible</th>
                <th className="py-2.5 px-3">Livraison</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {detail!.invitations.length === 0 ? (
                <tr><td colSpan={4} className="py-6 px-4 text-center text-xs font-semibold text-slate-400">Aucune invitation enregistrée.</td></tr>
              ) : (
                detail!.invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px]">{inv.userName ?? inv.userId}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.participantRole}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={inv.joinEligible ? 'success' : 'danger'}>{inv.joinEligible ? 'Oui' : 'Non'}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.deliveryState}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
