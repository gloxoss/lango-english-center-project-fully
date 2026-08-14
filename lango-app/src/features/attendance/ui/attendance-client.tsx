'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  UserCheck, UserX, Clock, Save, CheckCircle2, Download, Check, FileText, CheckCheck, AlertTriangle, XCircle, Search,
} from 'lucide-react';
import {
  AttendanceStatus, RosterStudent, INITIAL_ROSTER, CLASSES, SUBJECTS, STATUS_OPTIONS,
} from '../data/attendance-config';

export function AttendanceClient({ locale: _locale }: { locale?: string } = {}) {
  const [selectedClass, setSelectedClass] = useState('cl-1');
  const [selectedSubject, setSelectedSubject] = useState('sub-1');
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [roster] = useState<RosterStudent[]>(INITIAL_ROSTER);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(INITIAL_ROSTER.map(s => [s.id, s.defaultStatus]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<string, string>>({});
  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    for (const s of roster) updated[s.id] = status;
    setStatuses(updated);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
  };

  const filteredRoster = roster.filter(st =>
    st.name.toLowerCase().includes(search.toLowerCase()) ||
    st.matricule.toLowerCase().includes(search.toLowerCase())
  );

  const counts = roster.reduce(
    (acc, s) => {
      const status = statuses[s.id] ?? 'present';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excused: 0 } as Record<AttendanceStatus, number>
  );
  const total = roster.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Registre des Présences</h1>
          <p className="text-xs text-slate-500 mt-1">Saisie et contrôle des présences par classe, matière et séance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-10 px-4 rounded-xl border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Saved message */}
      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Présences enregistrées avec succès pour la Période {selectedPeriod}.</span>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end flex-wrap gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-10 px-3.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Classe</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-52 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder="Sélectionner classe" />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Matière</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-48 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder="Toutes matières" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">Séance</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8].map(p => <SelectItem key={p} value={String(p)}>Période {p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          size="sm"
          className="h-10 px-5 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2"
          disabled={saving}
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1">Actions rapides:</span>
          <button
            type="button"
            onClick={() => markAll('present')}
            className="px-3 py-1.5 bg-emerald-100/70 text-emerald-700 hover:bg-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Tout Présent
          </button>
          <button
            type="button"
            onClick={() => markAll('absent')}
            className="px-3 py-1.5 bg-rose-100/70 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" /> Tout Absent
          </button>
        </div>

        <div className="relative w-56">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher élève..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs rounded-xl bg-white border-slate-200/80"
          />
        </div>
      </div>

      {/* KPI Band */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Présents', count: counts.present, icon: UserCheck, bg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]', pctColor: 'text-[#2487B8]' },
          { label: 'Retards', count: counts.late, icon: Clock, bg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]', pctColor: 'text-[#E8A33D]' },
          { label: 'Absents', count: counts.absent, icon: UserX, bg: 'bg-[#FCE4E2]', iconColor: 'text-[#E5544B]', pctColor: 'text-[#E5544B]' },
          { label: 'Excusés', count: counts.excused, icon: FileText, bg: 'bg-purple-100', iconColor: 'text-purple-700', pctColor: 'text-purple-700' },
        ].map(kpi => (
          <div key={kpi.label} className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full ${kpi.bg} ${kpi.iconColor} flex items-center justify-center shrink-0`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">{kpi.label}</p>
              <p className="text-base font-extrabold text-[#16212B]">
                {kpi.count} <span className={`text-[10px] font-bold ${kpi.pctColor}`}>{pct(kpi.count)}</span>
              </p>
            </div>
          </div>
        ))}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 col-span-2 sm:col-span-1 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-extrabold text-slate-600">{total}</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">Effectif total</p>
            <p className="text-xs font-extrabold text-[#16212B]">élèves inscrits</p>
          </div>
        </div>
      </div>

      {/* Attendance Table with 36px Circular Avatars */}
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Élève</th>
                <th className="py-3.5 px-4 text-center w-24">Assiduité</th>
                {STATUS_OPTIONS.map(opt => (
                  <th key={opt.key} className="py-3.5 px-4 text-center w-32">{opt.label}</th>
                ))}
                <th className="py-3.5 px-4 w-52">Note / Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.map(st => {
                const status = statuses[st.id] ?? 'present';
                const isLowAttendance = st.attendanceRate < 80;
                return (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {/* 36px Circular Avatar */}
                        <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                          {st.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#16212B]">{st.name}</p>
                            {isLowAttendance && (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Alerte
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">{st.matricule}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.attendanceRate < 80 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {st.attendanceRate}%
                      </span>
                    </td>
                    {STATUS_OPTIONS.map(opt => (
                      <td key={opt.key} className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(st.id, opt.key)}
                          className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${
                            status === opt.key
                              ? `${opt.activeBg} ${opt.activeText} shadow-xs`
                              : 'text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            status === opt.key ? `${opt.dotColor} border-transparent` : 'border-slate-300'
                          }`}>
                            {status === opt.key && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                        </button>
                      </td>
                    ))}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {status === 'late' && (
                          <input
                            type="number"
                            min={1}
                            max={120}
                            placeholder="min"
                            value={lateMinutes[st.id] ?? ''}
                            onChange={e => setLateMinutes(prev => ({ ...prev, [st.id]: e.target.value }))}
                            className="w-16 h-8 px-2 text-xs bg-amber-50 border border-amber-200 rounded-lg focus:outline-none shrink-0"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="Note / motif..."
                          value={notes[st.id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [st.id]: e.target.value }))}
                          className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2487B8]/40"
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
    </div>
  );
}
