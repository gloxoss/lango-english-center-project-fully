'use client';

import { AlertCircle, ArrowLeft, FileText, Mail, MessageSquare, Phone, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FlagType = 'UNJUSTIFIED_ABSENCE' | 'REPEATED_LATE' | 'CONSECUTIVE_ABSENCE';
type FlagSeverity = 'CRITIQUE' | 'ELEVE' | 'MOYEN';

type ApiFlagDetail = {
  id: string;
  studentId: string;
  studentName: string;
  type: FlagType;
  status: 'OPEN' | 'RESOLVED';
  severity: FlagSeverity;
  assignedToId: string | null;
  assignedToName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  attendanceRate: number | null;
  detectedAt: string;
  resolvedAt: string | null;
  recentEvents: { date: string; status: string; lateMinutes: number | null; note: string | null }[];
  linkedExcuse: { id: string; status: string; documentUrl: string | null; reason: string } | null;
  smsHistory: { id: string; body: string; status: string; sentAt: string | null; recipientPhone: string }[];
  recommendedAction: string | null;
};

type ApiNote = { id: string; body: string; createdAt: string; authorName: string };
type StaffOption = { id: string; fullName: string };

const TYPE_LABELS: Record<FlagType, string> = {
  UNJUSTIFIED_ABSENCE: 'Absence non justifiée',
  CONSECUTIVE_ABSENCE: 'Absences consécutives',
  REPEATED_LATE: 'Retards répétés',
};

const STATUS_EVENT_LABELS: Record<string, string> = {
  present: 'Présent',
  late: 'Retard',
  absent: 'Absent',
  excused: 'Excusé',
};

function severityBadge(severity: FlagSeverity) {
  switch (severity) {
    case 'CRITIQUE':
      return <Badge className="bg-[#FCE4E2] text-[#E5544B]">Critique</Badge>;
    case 'ELEVE':
      return <Badge className="bg-[#FCF0DC] text-[#E8A33D]">Élevé</Badge>;
    default:
      return <Badge variant="neutral">Moyen</Badge>;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AttendanceFlagDetailView({ id, locale }: { id: string; locale: string }) {
  const [flag, setFlag] = useState<ApiFlagDetail | null>(null);
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [smsBody, setSmsBody] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function loadFlag() {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/flags/detail?id=${id}`);
      const json = await res.json();
      if (json.success) {
        setFlag(json.data);
      }
    } catch (err) {
      console.error('Failed loading flag detail', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotes() {
    try {
      const res = await fetch(`/api/attendance/flags/notes?flagId=${id}`);
      const json = await res.json();
      if (json.success) {
        setNotes(json.data);
      }
    } catch (err) {
      console.error('Failed loading notes', err);
    }
  }

  useEffect(() => {
    loadFlag();
    loadNotes();
    fetch('/api/users?role=teacher&pageSize=100')
      .then(r => r.json())
      .then(json => json.success && setStaff(json.data))
      .catch(err => console.error('Failed loading staff', err));
  }, [id]);

  async function updateFlag(patch: { assignedToId?: string | null; status?: 'OPEN' | 'RESOLVED' }) {
    setUpdating(true);
    try {
      const res = await fetch('/api/attendance/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: id, ...patch }),
      });
      const json = await res.json();
      if (json.success) {
        await loadFlag();
      }
    } catch (err) {
      console.error('Flag update failed', err);
    } finally {
      setUpdating(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) {
      return;
    }
    setSavingNote(true);
    try {
      const res = await fetch('/api/attendance/flags/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: id, body: newNote.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewNote('');
        await loadNotes();
      }
    } catch (err) {
      console.error('Add note failed', err);
    } finally {
      setSavingNote(false);
    }
  }

  async function sendSms() {
    if (!flag?.guardianPhone || !smsBody.trim()) {
      return;
    }
    setSendingSms(true);
    setSmsStatus(null);
    try {
      const res = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientPhone: flag.guardianPhone, studentId: flag.studentId, body: smsBody.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setSmsBody('');
        setSmsStatus({ kind: 'success', text: 'SMS enregistré (mode simulation, aucun envoi réel).' });
        await loadFlag();
      } else {
        setSmsStatus({ kind: 'error', text: json.error?.message || json.message || 'Envoi impossible.' });
      }
    } catch (err) {
      console.error('Send SMS failed', err);
      setSmsStatus({ kind: 'error', text: 'Erreur réseau.' });
    } finally {
      setSendingSms(false);
    }
  }

  if (loading) {
    return <div className="max-w-[1200px] mx-auto text-sm text-slate-500">Chargement...</div>;
  }

  if (!flag) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-4">
        <Link href={`/${locale}/dashboard/attendance/flags`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#2487B8]">
          <ArrowLeft className="w-4 h-4" />
          Retour aux signalements
        </Link>
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Signalement introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <Link href={`/${locale}/dashboard/attendance/flags`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#2487B8]">
        <ArrowLeft className="w-4 h-4" />
        Retour aux signalements
      </Link>

      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-lg flex items-center justify-center">
            {flag.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/${locale}/dashboard/students/${flag.studentId}`} className="text-lg font-extrabold text-[#16212B] hover:text-[#2487B8]">
                {flag.studentName}
              </Link>
              {severityBadge(flag.severity)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABELS[flag.type]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <p className="text-[10px] font-bold text-slate-400">Taux de présence</p>
            <p className="text-lg font-extrabold text-[#16212B]">{flag.attendanceRate !== null ? `${flag.attendanceRate}%` : '—'}</p>
          </div>
          <Badge className={flag.status === 'OPEN' ? 'bg-[#FCF0DC] text-[#E8A33D]' : 'bg-[#D1F5E8] text-[#17A673]'}>
            {flag.status === 'OPEN' ? 'À traiter' : 'Résolu'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16212B] mb-3">Historique de présence récent</h3>
            <div className="space-y-1.5">
              {flag.recentEvents.length === 0 && <p className="text-xs text-slate-400">Aucun enregistrement.</p>}
              {flag.recentEvents.map(e => (
                <div key={e.date} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-none text-xs">
                  <span className="text-slate-600">{new Date(`${e.date}T00:00:00`).toLocaleDateString('fr-FR')}</span>
                  <span className="text-slate-400">{e.note ?? ''}</span>
                  <Badge className={
                    e.status === 'present' ? 'bg-[#DCEBF4] text-[#1B6C93] text-[10px]'
                      : e.status === 'excused' ? 'bg-purple-100 text-purple-800 text-[10px]'
                        : e.status === 'late' ? 'bg-[#FCF0DC] text-[#E8A33D] text-[10px]'
                          : 'bg-[#FCE4E2] text-[#E5544B] text-[10px]'
                  }
                  >
                    {STATUS_EVENT_LABELS[e.status] ?? e.status}
                    {e.status === 'late' && e.lateMinutes ? ` (${e.lateMinutes} min)` : ''}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16212B] mb-3">Document justificatif lié</h3>
            {flag.linkedExcuse
              ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-700">{flag.linkedExcuse.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="text-[10px]">{flag.linkedExcuse.status}</Badge>
                      {flag.linkedExcuse.documentUrl && (
                        <a href={flag.linkedExcuse.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#2487B8] hover:underline">
                          Voir le document
                        </a>
                      )}
                    </div>
                  </div>
                )
              : <p className="text-xs text-slate-400">Aucun document lié à ce signalement.</p>}
          </Card>

          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16212B] mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              Historique des SMS envoyés
            </h3>
            <div className="space-y-2">
              {flag.smsHistory.length === 0 && <p className="text-xs text-slate-400">Aucun SMS envoyé.</p>}
              {flag.smsHistory.map(sms => (
                <div key={sms.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-slate-500">{sms.recipientPhone}</span>
                    <Badge variant="neutral" className="text-[10px]">{sms.sentAt ? formatDateTime(sms.sentAt) : sms.status}</Badge>
                  </div>
                  <p className="text-slate-700">{sms.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16212B] mb-3">Notes internes</h3>
            <div className="space-y-2 mb-3">
              {notes.length === 0 && <p className="text-xs text-slate-400">Aucune note.</p>}
              {notes.map(n => (
                <div key={n.id} className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs">
                  <p className="text-slate-700">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {n.authorName}
                    {' '}
                    •
                    {' '}
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Ajouter une note interne..."
                className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2487B8]/40"
              />
              <Button size="sm" disabled={savingNote || !newNote.trim()} onClick={addNote} className="h-9 rounded-lg text-xs">
                Ajouter
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#16212B]">Résumé du signalement</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Détecté le</span><span className="font-semibold text-slate-700">{formatDateTime(flag.detectedAt)}</span></div>
              {flag.resolvedAt && <div className="flex justify-between"><span className="text-slate-400">Résolu le</span><span className="font-semibold text-slate-700">{formatDateTime(flag.resolvedAt)}</span></div>}
              {flag.recommendedAction && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Action recommandée</p>
                  <p className="text-slate-700 font-semibold">{flag.recommendedAction}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#16212B] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              Assignation
            </h3>
            <Select
              value={flag.assignedToId ?? 'none'}
              onValueChange={val => updateFlag({ assignedToId: val === 'none' ? null : val })}
              disabled={updating}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {flag.status === 'OPEN'
              ? (
                  <Button size="sm" disabled={updating} onClick={() => updateFlag({ status: 'RESOLVED' })} className="w-full h-9 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                    Marquer résolu
                  </Button>
                )
              : (
                  <Button size="sm" variant="outline" disabled={updating} onClick={() => updateFlag({ status: 'OPEN' })} className="w-full h-9 rounded-lg text-xs">
                    Rouvrir
                  </Button>
                )}
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
            <h3 className="text-sm font-bold text-[#16212B]">Contact tuteur</h3>
            {flag.guardianName
              ? (
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-700">{flag.guardianName}</p>
                    {flag.guardianPhone && <p className="flex items-center gap-1.5 text-slate-500"><Phone className="w-3.5 h-3.5" />{flag.guardianPhone}</p>}
                    {flag.guardianEmail && <p className="flex items-center gap-1.5 text-slate-500"><Mail className="w-3.5 h-3.5" />{flag.guardianEmail}</p>}
                  </div>
                )
              : <p className="text-xs text-slate-400">Aucun tuteur lié.</p>}

            {flag.guardianPhone && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <textarea
                  rows={2}
                  value={smsBody}
                  onChange={e => setSmsBody(e.target.value)}
                  placeholder="Écrire un SMS au tuteur..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#2487B8]/40"
                />
                {smsStatus && (
                  <p className={`text-[11px] font-semibold ${smsStatus.kind === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {smsStatus.text}
                  </p>
                )}
                <Button
                  size="sm"
                  disabled={sendingSms || !smsBody.trim()}
                  onClick={sendSms}
                  className="w-full h-9 rounded-lg text-xs"
                >
                  {sendingSms ? 'Envoi...' : 'Envoyer un SMS'}
                </Button>
                <p className="text-[10px] text-slate-400">Mode simulation : aucun SMS réel n'est envoyé.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
