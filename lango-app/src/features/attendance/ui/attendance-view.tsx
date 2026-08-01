'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Clock,
  UserX,
  FileText,
  Save,
  UserCheck,
  Check,
  AlertCircle,
  CheckCircle2,
  QrCode,
  CheckCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { QrScannerModal } from '@/features/attendance/ui/qr-scanner-modal';
import { authClient } from '@/libs/auth-client';

type ApiStudent = { id: string; fullName: string; classSectionId: string | null; className: string | null };
type ApiClass = { id: string; name: string };
type ApiSubject = { id: string; name: string };
type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
type RegisterInfo = {
  id: string;
  reference: string;
  status: 'LOCKED' | 'REOPENED';
  submittedAt: string;
  submittedByName: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  correctionNote: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceView() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);

  const [roster, setRoster] = useState<ApiStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<string, number | ''>>({});
  const [studentRates, setStudentRates] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  // Register lock/reopen state
  const [registerInfo, setRegisterInfo] = useState<RegisterInfo | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const { data: session } = authClient.useSession();
  const isSchoolAdmin = (session?.user as any)?.role === 'school_admin';

  async function loadRegisterStatus() {
    if (!selectedClassId) {
      return;
    }
    try {
      const res = await fetch(`/api/attendance/registers?classId=${selectedClassId}&date=${selectedDate}&period=${selectedPeriod}`);
      const json = await res.json();
      if (json.success) {
        setRegisterInfo(json.data);
        setCorrectionNote('');
        setShowReopenForm(false);
      }
    } catch (err) {
      console.error('Failed loading register status', err);
    }
  }

  useEffect(() => {
    async function loadClassesAndSubjects() {
      try {
        const [classRes, subjectRes] = await Promise.all([
          fetch('/api/academics/classes?pageSize=100'),
          fetch('/api/academics/subjects?pageSize=100').catch(() => null),
        ]);
        const classJson = await classRes.json();
        if (classJson.success) {
          setClasses(classJson.data);
          if (classJson.data.length > 0) {
            setSelectedClassId((current) => current || classJson.data[0].id);
          }
        }
        if (subjectRes) {
          const subjectJson = await subjectRes.json();
          if (subjectJson.success && Array.isArray(subjectJson.data)) {
            setSubjects(subjectJson.data);
          }
        }
      } catch (err) {
        console.error('Failed loading classes/subjects', err);
      }
    }
    loadClassesAndSubjects();
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      return;
    }
    async function loadRosterAndAttendance() {
      setLoading(true);
      setError(null);
      try {
        const [studentsRes, attendanceRes, summaryRes] = await Promise.all([
          fetch(`/api/students?classId=${selectedClassId}&pageSize=100`),
          fetch(`/api/attendance?date=${selectedDate}&classId=${selectedClassId}&period=${selectedPeriod}${selectedSubjectId ? `&subjectId=${selectedSubjectId}` : ''}`),
          fetch('/api/attendance/summary').catch(() => null),
        ]);
        const studentsJson = await studentsRes.json();
        const attendanceJson = await attendanceRes.json();

        const students: ApiStudent[] = studentsJson.success ? studentsJson.data : [];
        setRoster(students);

        const nextStatuses: Record<string, AttendanceStatus> = {};
        const nextNotes: Record<string, string> = {};
        const nextLateMinutes: Record<string, number | ''> = {};
        for (const s of students) {
          nextStatuses[s.id] = 'present';
          nextNotes[s.id] = '';
          nextLateMinutes[s.id] = '';
        }

        if (attendanceJson.success && Array.isArray(attendanceJson.data)) {
          for (const rec of attendanceJson.data as { studentId: string; status: AttendanceStatus; note?: string; lateMinutes?: number | null }[]) {
            if (rec.studentId in nextStatuses) {
              nextStatuses[rec.studentId] = rec.status;
              if (rec.note) {
                nextNotes[rec.studentId] = rec.note;
              }
              if (rec.lateMinutes) {
                nextLateMinutes[rec.studentId] = rec.lateMinutes;
              }
            }
          }
        }
        setStatuses(nextStatuses);
        setNotes(nextNotes);
        setLateMinutes(nextLateMinutes);

        if (summaryRes) {
          const summaryJson = await summaryRes.json();
          if (summaryJson.success && Array.isArray(summaryJson.data)) {
            const ratesMap: Record<string, number> = {};
            for (const item of summaryJson.data) {
              ratesMap[item.studentId] = Number(item.attendanceRate);
            }
            setStudentRates(ratesMap);
          }
        }
      } catch (err) {
        console.error('Failed loading roster/attendance', err);
        setError('Impossible de charger la liste des élèves.');
      } finally {
        setLoading(false);
      }
    }
    loadRosterAndAttendance();
    loadRegisterStatus();
  }, [selectedClassId, selectedDate, selectedPeriod, selectedSubjectId]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setNotes(prev => ({ ...prev, [studentId]: note }));
  };

  const handleLateMinutesChange = (studentId: string, value: string) => {
    setLateMinutes(prev => ({ ...prev, [studentId]: value === '' ? '' : Math.max(1, Number(value)) }));
  };

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    for (const s of roster) {
      updated[s.id] = status;
    }
    setStatuses(updated);
  };

  const handleQrScan = (studentId: string) => {
    if (isLocked) {
      setQrMessage('⚠ Registre verrouillé, le scan ne peut pas être enregistré.');
      return;
    }
    const student = roster.find(s => s.id === studentId || s.fullName.toLowerCase().includes(studentId.toLowerCase()));
    if (student) {
      handleStatusChange(student.id, 'present');
      setQrMessage(`✔ Élève marqué présent : ${student.fullName}`);
    } else {
      setQrMessage(`❌ Élève non trouvé dans le registre.`);
    }
  };

  async function handleSave() {
    if (roster.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          studentGroupId: selectedClassId || undefined,
          subjectId: selectedSubjectId || undefined,
          period: selectedPeriod,
          records: roster.map(s => ({
            studentId: s.id,
            status: statuses[s.id] ?? 'present',
            note: notes[s.id] || undefined,
            lateMinutes: statuses[s.id] === 'late' && lateMinutes[s.id] ? Number(lateMinutes[s.id]) : undefined,
          })),
          correctionNote: registerInfo?.status === 'REOPENED' ? correctionNote : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Échec de l\'enregistrement des présences.');
        return;
      }
      setSuccess(json.message || `Présences enregistrées avec succès pour la Période ${selectedPeriod}.`);
      await loadRegisterStatus();
    } catch (err) {
      console.error('Attendance save failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    if (!registerInfo || !reopenReason.trim()) {
      return;
    }
    setReopening(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/registers/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: registerInfo.id, reason: reopenReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Échec de la réouverture du registre.');
        return;
      }
      setReopenReason('');
      await loadRegisterStatus();
    } catch (err) {
      console.error('Register reopen failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setReopening(false);
    }
  }

  const isLocked = registerInfo?.status === 'LOCKED';
  const isReopened = registerInfo?.status === 'REOPENED';
  const canSave = !isLocked && (!isReopened || correctionNote.trim().length > 0);

  const counts = roster.reduce(
    (acc, s) => {
      const status = statuses[s.id] ?? 'present';
      acc[status] += 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excused: 0 } as Record<AttendanceStatus, number>,
  );
  const total = roster.length;
  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Registre des Présences</h1>
          <p className="text-xs text-slate-500 mt-1">Saisie et contrôle des présences par classe, matière et séance</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-10 px-4 rounded-full border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="w-4 h-4 text-[#2487B8]" />
            <span>Scanner QR Badge</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {isLocked && registerInfo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5 text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">
                Registre
                {' '}
                {registerInfo.reference}
                {' '}
                soumis et verrouillé
              </p>
              <p className="mt-0.5">
                Soumis par
                {' '}
                {registerInfo.submittedByName ?? '—'}
                {' '}
                le
                {' '}
                {new Date(registerInfo.submittedAt).toLocaleString('fr-FR')}
                . La modification directe n'est plus possible.
              </p>
            </div>
          </div>
          {isSchoolAdmin && (
            showReopenForm
              ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Motif de la réouverture (obligatoire)..."
                      value={reopenReason}
                      onChange={e => setReopenReason(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <Button size="sm" disabled={reopening || !reopenReason.trim()} onClick={handleReopen} className="h-9 rounded-lg text-xs">
                      Confirmer la réouverture
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowReopenForm(false)} className="h-9 rounded-lg text-xs">
                      Annuler
                    </Button>
                  </div>
                )
              : (
                  <Button size="sm" variant="outline" onClick={() => setShowReopenForm(true)} className="h-9 rounded-lg text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                    Réouvrir (motif requis)
                  </Button>
                )
          )}
        </div>
      )}

      {isReopened && registerInfo && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5 text-orange-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Registre rouvert par l'administration</p>
              <p className="mt-0.5">
                Motif :
                {' '}
                {registerInfo.reopenReason}
              </p>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-orange-700 block mb-1">Note de correction (obligatoire pour renvoyer le registre)</label>
            <textarea
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Décrivez la correction apportée..."
              className="w-full px-3 py-2 text-xs bg-white border border-orange-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 px-3.5 text-xs bg-slate-50 border border-slate-200/80 rounded-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Classe</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[180px] rounded-full h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder="Sélectionnez classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subjects.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400">Matière / Cours</label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="w-[180px] rounded-full h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                  <SelectValue placeholder="Toutes matières" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes matières</SelectItem>
                  {subjects.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Séance / Période</label>
            <Select value={String(selectedPeriod)} onValueChange={(val) => setSelectedPeriod(parseInt(val, 10))}>
              <SelectTrigger className="w-[140px] rounded-full h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                  <SelectItem key={p} value={String(p)}>Période {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" className="gap-2 h-10 px-5 rounded-full" disabled={saving || loading || roster.length === 0 || !canSave} onClick={handleSave}>
            <Save className="w-4 h-4" />
            <span>{saving ? 'Enregistrement...' : isLocked ? 'Registre verrouillé' : 'Enregistrer'}</span>
          </Button>
        </div>
      </div>

      {/* Quick Action Toolbar */}
      <div className="flex items-center justify-between bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1">Actions rapides:</span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => markAll('present')}
            className="px-3 py-1.5 bg-emerald-100/70 text-emerald-700 hover:bg-emerald-200 rounded-full text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Tout Présent</span>
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => markAll('absent')}
            className="px-3 py-1.5 bg-rose-100/70 text-rose-700 hover:bg-rose-200 rounded-full text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Tout Absent</span>
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-400">
          Taux global : <span className="text-[#2487B8] font-extrabold">{pct(counts.present + counts.late + counts.excused)}</span>
        </div>
      </div>

      {/* KPI Stats Pill Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">Présents</p>
              <p className="text-base font-extrabold text-[#16212B]">{counts.present} <span className="text-[10px] font-bold text-[#2487B8]">{pct(counts.present)}</span></p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">Retards</p>
              <p className="text-base font-extrabold text-[#16212B]">{counts.late} <span className="text-[10px] font-bold text-[#E8A33D]">{pct(counts.late)}</span></p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">Absents</p>
              <p className="text-base font-extrabold text-[#16212B]">{counts.absent} <span className="text-[10px] font-bold text-[#E5544B]">{pct(counts.absent)}</span></p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">Excusés</p>
              <p className="text-base font-extrabold text-[#16212B]">{counts.excused} <span className="text-[10px] font-bold text-purple-700">{pct(counts.excused)}</span></p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-[11px] font-bold text-slate-500">Effectif total</p>
            <p className="text-base font-extrabold text-[#16212B]">{total} <span className="text-xs font-normal text-slate-400">élèves</span></p>
          </div>
        </div>
      </div>

      {/* Attendance Table Matrix */}
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Élève</th>
                <th className="py-3 px-4 text-center w-28">Taux assiduité</th>
                <th className="py-3 px-4 text-center w-36">Présent</th>
                <th className="py-3 px-4 text-center w-36">Retard</th>
                <th className="py-3 px-4 text-center w-36">Absent</th>
                <th className="py-3 px-4 text-center w-36">Excusé</th>
                <th className="py-3 px-4 w-48">Remarque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && roster.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">Aucun élève dans cette classe.</td>
                </tr>
              )}
              {roster.map((st) => {
                const status = statuses[st.id] ?? 'present';
                const rate = studentRates[st.id];
                const isLowAttendance = rate !== undefined && rate < 80;

                const options: { key: AttendanceStatus; activeBg: string; activeText: string; border: string }[] = [
                  { key: 'present', activeBg: 'bg-[#DCEBF4]', activeText: 'text-[#1B6C93]', border: 'border-[#2487B8] bg-[#2487B8]' },
                  { key: 'late', activeBg: 'bg-[#FCF0DC]', activeText: 'text-[#E8A33D]', border: 'border-[#E8A33D] bg-[#E8A33D]' },
                  { key: 'absent', activeBg: 'bg-[#FCE4E2]', activeText: 'text-[#E5544B]', border: 'border-[#E5544B] bg-[#E5544B]' },
                  { key: 'excused', activeBg: 'bg-purple-100', activeText: 'text-purple-800', border: 'border-purple-600 bg-purple-600' },
                ];
                return (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-[#16212B]">{st.fullName}</p>
                          <p className="text-[10px] text-slate-400">{st.className ?? '—'}</p>
                        </div>
                        {isLowAttendance && (
                          <span title="Alerte assiduité < 80%" className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Attention</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-bold">
                      {rate !== undefined ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${rate < 80 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {rate}%
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {options.map(opt => (
                      <td key={opt.key} className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleStatusChange(st.id, opt.key)}
                          className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            status === opt.key ? `${opt.activeBg} ${opt.activeText} font-bold shadow-2xs` : 'text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${status === opt.key ? `${opt.border} text-white` : 'border-slate-300'}`}>
                            {status === opt.key && <Check className="w-2.5 h-2.5" />}
                          </span>
                        </button>
                      </td>
                    ))}

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {status === 'late' && (
                          <input
                            type="number"
                            min={1}
                            max={600}
                            placeholder="min"
                            disabled={isLocked}
                            value={lateMinutes[st.id] ?? ''}
                            onChange={(e) => handleLateMinutesChange(st.id, e.target.value)}
                            className="w-16 h-8 px-2 text-xs bg-amber-50 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400/50 shrink-0 disabled:opacity-50"
                            title="Minutes de retard"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="Note / motif..."
                          disabled={isLocked}
                          value={notes[st.id] || ''}
                          onChange={(e) => handleNoteChange(st.id, e.target.value)}
                          className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2487B8]/40 disabled:opacity-50"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* QR Code Scanner Modal */}
      <QrScannerModal
        open={showQrModal}
        onClose={() => { setShowQrModal(false); setQrMessage(null); }}
        qrInput={qrInput}
        onQrInputChange={setQrInput}
        onScan={(value) => {
          handleQrScan(value);
          setQrInput('');
        }}
        qrMessage={qrMessage}
      />
    </div>
  );
}
