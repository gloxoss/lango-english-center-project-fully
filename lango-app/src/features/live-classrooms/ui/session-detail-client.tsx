'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Video, Play, Square, XCircle, RefreshCw, Download, Paperclip,
  Users, ListChecks, AlertTriangle, Clock, ExternalLink, Trash2, Plus, CircleCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LiveClassroomStudio } from './live-classroom-studio';
import {
  getSessionDetail, getAttendance, getRecordings, getMaterials, joinSession, redeemJoin,
  startSession, endSession, cancelSession, reconcileAttendance, postAttendance,
  syncRecordings, deleteRecording, attachMaterial, detachMaterial, errorMessage,
} from '../data/api';

export function SessionDetailClient({ sessionId, locale }: { sessionId: string; locale: string }) {
  const t = useTranslations('LiveClassrooms');
  const tCommon = useTranslations('Common');

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getSessionDetail>> | null>(null);
  const [attendance, setAttendance] = useState<Awaited<ReturnType<typeof getAttendance>> | null>(null);
  const [recordings, setRecordings] = useState<Awaited<ReturnType<typeof getRecordings>> | null>(null);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof getMaterials>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [isLiveRoomOpen, setIsLiveRoomOpen] = useState(false);
  const [reconcileNote, setReconcileNote] = useState('');
  const [newAssetId, setNewAssetId] = useState('');

  const STATUS_STYLES: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal'; labelKey: string }> = {
    draft: { variant: 'neutral', labelKey: 'statusDraft' },
    scheduled: { variant: 'info', labelKey: 'statusScheduled' },
    waiting: { variant: 'warning', labelKey: 'statusWaiting' },
    live: { variant: 'success', labelKey: 'statusLive' },
    ended: { variant: 'neutral', labelKey: 'statusEnded' },
    cancelled: { variant: 'danger', labelKey: 'statusCancelled' },
    failed: { variant: 'danger', labelKey: 'statusFailed' },
    expired: { variant: 'neutral', labelKey: 'statusExpired' },
  };

  const ATTENDANCE_CONFIG: Record<string, string> = {
    present: 'attendancePresent',
    late: 'attendanceLate',
    early: 'attendanceEarly',
    absent: 'attendanceAbsent',
    unknown: 'attendanceUnknown',
  };

  const RECON_CONFIG: Record<string, string> = {
    pending: 'reconPending',
    proposed: 'reconProposed',
    approved: 'reconApproved',
    rejected: 'reconRejected',
    posted: 'reconPosted',
  };

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
      // If session is scheduled/waiting, start it first so it becomes live
      if (s.status === 'scheduled' || s.status === 'waiting') {
        try {
          await startSession(sessionId);
          await loadAll();
        } catch {
          // non-fatal if already started
        }
      }
      const grant = await joinSession(sessionId);
      const redeemed = await redeemJoin(sessionId, grant.token);
      setJoinUrl(redeemed.url);
      setIsLiveRoomOpen(true);
      setNotice(t('tokenIssuedNotice', {
        role: redeemed.role === 'moderator' ? t('roleModerator') : t('roleParticipant'),
        devNotice: redeemed.providerType === 'dev' ? `(${t('devProvider')})` : '',
      }));
    } catch (err) {
      setError(errorMessage(err));
      if (detail?.providerType === 'dev') {
        setIsLiveRoomOpen(true);
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm font-semibold text-slate-400">{t('loadingSessions')}</div>;
  }

  if (error && !detail) {
    return (
      <div className="max-w-[1200px] mx-auto p-6 space-y-6">
        <Link href={`/${locale}/dashboard/academics/live-class`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2487B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" /> {t('backToSessionsList')}
        </Link>
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      </div>
    );
  }

  const s = detail!.session;
  const cfg = STATUS_STYLES[s.status] ?? { variant: 'neutral' as const, labelKey: 'statusDraft' };
  const stLabel = STATUS_STYLES[s.status] ? t(cfg.labelKey as any) : s.status;
  const canHost = s.status === 'scheduled' || s.status === 'waiting' || s.status === 'live';
  const isLive = s.status === 'live';
  const policy = (s.policy ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Back + title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard/academics/live-class`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2487B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" /> {t('backToSessions')}
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
              <Video className="w-6 h-6 text-[#2487B8]" /> {s.title}
              <Badge variant={cfg.variant}>{stLabel}</Badge>
            </h1>
            <p className="text-xs text-slate-500 mt-1 text-start">
              {detail!.className ?? t('colClass')} · {detail!.sectionName ?? ''} · {detail!.subjectName ?? t('colSubject')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => run('refresh', loadAll, t('dataRefreshedNotice'))} disabled={busy !== null}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> {tCommon('refresh')}
          </button>
          {isLive && (
            <button onClick={() => run('end', () => endSession(sessionId), t('sessionEndedNotice'))} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <Square className="h-3.5 w-3.5" /> {t('actionEnd')}
            </button>
          )}
          {canHost && !isLive && (
            <button onClick={() => run('start', () => startSession(sessionId), t('sessionStartedNotice'))} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <Play className="h-3.5 w-3.5" /> {t('actionStart')}
            </button>
          )}
          {(s.status === 'scheduled' || s.status === 'waiting' || s.status === 'draft') && (
            <button onClick={() => run('cancel', () => cancelSession(sessionId), t('sessionCancelledNotice'))} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <XCircle className="h-3.5 w-3.5" /> {t('actionCancel')}
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
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-start">
            <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-[#2487B8]" /> {t('sessionConnectionHeading')}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {detail!.providerType === 'dev'
                ? 'Salle Virtuelle Instantanée WebRTC (Caméra, micro, tableau blanc & partage d\'écran sans configuration)'
                : t('providerLabelPrefix', { provider: detail!.profileName ?? detail!.providerType ?? '' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!joinUrl) {
                  handleJoin();
                } else {
                  setIsLiveRoomOpen(prev => !prev);
                }
              }}
              disabled={busy === 'join' || !canHost}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer shadow-xs"
            >
              <Video className="h-3.5 w-3.5 text-emerald-400" />
              {busy === 'join' ? t('generatingToken') : isLiveRoomOpen ? 'Masquer la caméra' : '🎥 Démarrer la Visio Directe'}
            </button>
            <button
              onClick={handleJoin}
              disabled={busy === 'join' || !canHost}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
            >
              {t('joinSessionBtn')}
            </button>
          </div>
        </div>
        {joinUrl && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-start">
            <p className="text-[11px] font-bold text-slate-500">{t('devLinkWarning')}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 break-all">{joinUrl}</code>
              <a
                href={joinUrl.startsWith('http') ? joinUrl : `https://meet.jit.si/SchoolOS-Live-${sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
              >
                {t('actionOpen')}
              </a>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 leading-relaxed">
              <strong>💡 Comment être accepté dans la réunion :</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                <li><strong>Dans SchoolOS :</strong> La visio directe s&apos;ouvre automatiquement ci-dessous (caméra, micro, écran 100% direct, 0 compte requis).</li>
                <li><strong>Dans l&apos;onglet Jitsi externe :</strong> Si vous voyez <em>&quot;The conference has not yet started...&quot;</em>, cliquez sur le bouton bleu <strong>&quot;I am the host&quot; / &quot;Je suis l&apos;hôte&quot;</strong> et connectez-vous avec votre compte Google. La salle s&apos;ouvrira instantanément pour tous les participants.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Live Classroom Studio */}
      {isLiveRoomOpen && (
        <LiveClassroomStudio
          sessionTitle={s.title}
          teacherName={detail!.teacherName ?? 'Enseignant'}
          className={detail!.className ? `${detail!.className} ${detail!.sectionName ?? ''}`.trim() : undefined}
          onClose={() => setIsLiveRoomOpen(false)}
          externalJoinUrl={joinUrl?.startsWith('http') ? joinUrl : `https://meet.jit.si/SchoolOS-Live-${sessionId}`}
          roster={(detail!.invitations ?? []).map(inv => ({
            userId: inv.userId,
            name: inv.userName ?? inv.userId,
            role: inv.participantRole,
          }))}
        />
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]"><Clock className="w-5 h-5" /></div>
          <div className="text-start">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cardScheduled')}</p>
            <p className="text-sm font-extrabold text-[#16212B]">{new Date(s.scheduledStart).toLocaleString(undefined)}</p>
            <p className="text-[10px] text-slate-500">{new Date(s.scheduledEnd).toLocaleString(undefined)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]"><Users className="w-5 h-5" /></div>
          <div className="text-start">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cardTeacher')}</p>
            <p className="text-sm font-extrabold text-[#16212B]">{detail!.teacherName ?? '—'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700"><ListChecks className="w-5 h-5" /></div>
          <div className="text-start">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cardPolicy')}</p>
            <p className="text-xs font-bold text-[#16212B]">
              {policy.recordingEnabled ? t('recordingActive') : t('recordingDisabled')}
              {policy.waitingRoom ? t('waitingRoomTag') : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance + Reconcile */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#2487B8]" /> {t('attendanceReconHeading')}
          </h2>
          <div className="flex items-center gap-2">
            <input value={reconcileNote} onChange={e => setReconcileNote(e.target.value)} placeholder={t('reconcileReasonPlaceholder')}
              className="h-8 w-56 rounded-lg border border-slate-200 px-2 text-[11px] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start" />
            <button onClick={() => run('reconcile', () => reconcileAttendance(sessionId, { note: reconcileNote }), t('reconciliationProposedNotice'))} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2.5 text-[11px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <RefreshCw className="h-3 w-3" /> {t('reconcileBtn')}
            </button>
            <button onClick={() => run('post', () => postAttendance(sessionId, reconcileNote), t('attendancePostedNotice'))} disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <Download className="h-3 w-3" /> {t('postToRegisterBtn')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4 text-start">{t('colStudent')}</th>
                <th className="py-2.5 px-3 text-center">{t('colStatus')}</th>
                <th className="py-2.5 px-3 text-end">{t('colPresence')}</th>
                <th className="py-2.5 px-3 text-end">{t('colReconnects')}</th>
                <th className="py-2.5 px-3 text-center">{t('colReconciliation')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(attendance ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-xs font-semibold text-slate-400">{t('noAttendanceDerived')}</td></tr>
              ) : (
                attendance!.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px] text-start">{a.userName ?? a.userId}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="info">
                        {ATTENDANCE_CONFIG[a.status] ? t(ATTENDANCE_CONFIG[a.status] as any) : a.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-end text-slate-600 font-mono">
                      {Math.round(a.totalPresenceSeconds / 60)} min
                    </td>
                    <td className="py-2.5 px-3 text-end text-slate-600">{a.reconnectCount}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={a.reconciliationState === 'posted' ? 'success' : a.reconciliationState === 'proposed' ? 'warning' : 'neutral'}>
                        {RECON_CONFIG[a.reconciliationState] ? t(RECON_CONFIG[a.reconciliationState] as any) : a.reconciliationState}
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
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Download className="w-4 h-4 text-[#2487B8]" /> {t('recordingsHeading')}
          </h2>
          <button onClick={() => run('syncRec', () => syncRecordings(sessionId), t('syncSuccessNotice'))} disabled={busy !== null}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
            <RefreshCw className="h-3 w-3" /> {t('syncRecordingsBtn')}
          </button>
        </div>
        <div className="p-4">
          {(recordings ?? []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 text-center py-4">
              {t('noRecordingsPolicyNote', { state: policy.recordingEnabled ? t('policyEnabled') : t('policyDisabled') })}
            </p>
          ) : (
            <div className="space-y-2">
              {recordings!.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="text-start">
                    <p className="text-[11px] font-bold text-[#16212B]">{r.providerRecordingId ?? t('recordingsHeading')}</p>
                    <p className="text-[10px] text-slate-500">
                      {r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min · ` : ''}
                      {r.expiresAt ? t('expiresOnDate', { date: new Date(r.expiresAt).toLocaleDateString() }) : t('unlimitedRetention')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.state === 'ready' ? 'success' : r.state === 'processing' ? 'warning' : 'danger'}>{r.state}</Badge>
                    {r.playbackUrl && (
                      <a href={r.playbackUrl} target="_blank" rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2 text-[10px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
                        <ExternalLink className="w-3 h-3" /> {t('actionPlayback')}
                      </a>
                    )}
                    <button onClick={() => run(`del${r.id}`, () => deleteRecording(sessionId, r.id), t('recordingDeletedNotice'))} disabled={busy !== null}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-rose-200 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
                      <Trash2 className="w-3 h-3" /> {t('actionDelete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Materials */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-[#2487B8]" /> {t('sharedMaterialsHeading')}
          </h2>
          <div className="flex items-center gap-2">
            <input value={newAssetId} onChange={e => setNewAssetId(e.target.value)} placeholder={t('assetIdPlaceholder')}
              className="h-8 w-64 rounded-lg border border-slate-200 px-2 text-[11px] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start" />
            <button onClick={() => run('attach', () => attachMaterial(sessionId, newAssetId), t('materialLinkedNotice'))} disabled={busy !== null || !newAssetId.trim()}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#2487B8] px-2.5 text-[11px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
              <Plus className="h-3 w-3" /> {t('actionLink')}
            </button>
          </div>
        </div>
        <div className="p-4">
          {(materials ?? []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 text-center py-4">{t('noSharedMaterials')}</p>
          ) : (
            <div className="space-y-2">
              {materials!.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="text-start">
                    <p className="text-[11px] font-bold text-[#16212B]">{m.title}</p>
                    <p className="text-[10px] text-slate-500">{m.status}</p>
                  </div>
                  <button onClick={() => run(`detach${m.assetId}`, () => detachMaterial(sessionId, m.assetId), t('materialDetachedNotice'))} disabled={busy !== null}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-rose-200 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
                    <Trash2 className="w-3 h-3" /> {t('actionDetach')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invitations */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#2487B8]" /> {t('rosterInvitationsHeading', { count: detail!.invitations.length })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4 text-start">{t('colUser')}</th>
                <th className="py-2.5 px-3 text-start">{t('colRole')}</th>
                <th className="py-2.5 px-3 text-center">{t('colEligible')}</th>
                <th className="py-2.5 px-3 text-start">{t('colDelivery')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {detail!.invitations.length === 0 ? (
                <tr><td colSpan={4} className="py-6 px-4 text-center text-xs font-semibold text-slate-400">{t('noInvitations')}</td></tr>
              ) : (
                detail!.invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px] text-start">{inv.userName ?? inv.userId}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-start">{inv.participantRole}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={inv.joinEligible ? 'success' : 'danger'}>{inv.joinEligible ? t('yes') : t('no')}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-start">{inv.deliveryState}</td>
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
