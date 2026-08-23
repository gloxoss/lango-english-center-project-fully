'use client';

import { AlertTriangle, Bell, Flag, TrendingDown, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type FlagTypeCount = { type: 'UNJUSTIFIED_ABSENCE' | 'REPEATED_LATE' | 'CONSECUTIVE_ABSENCE'; count: number };

type MissingRegister = {
  id: string;
  classSectionId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
};

type AuditSummary = {
  overallAttendanceRate: string | null;
  totalStudentsTracked: number;
  atRiskCount: number;
  openFlagsByType: FlagTypeCount[];
  missingRegistersToday: MissingRegister[];
};

const FLAG_LABELS: Record<FlagTypeCount['type'], string> = {
  UNJUSTIFIED_ABSENCE: 'Absences non justifiées',
  CONSECUTIVE_ABSENCE: 'Absences consécutives',
  REPEATED_LATE: 'Retards répétés',
};

const PAGE_SIZE = 10;

export function AttendanceAuditView({ locale: _locale }: { locale: string }) {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/audit-summary');
      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed loading audit summary', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sendReminder(slotId: string) {
    setSendingId(slotId);
    try {
      const res = await fetch('/api/attendance/audit-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classScheduleSlotId: slotId }),
      });
      const json = await res.json();
      if (json.success) {
        setSentIds(prev => new Set(prev).add(slotId));
      }
    } catch (err) {
      console.error('Reminder send failed', err);
    } finally {
      setSendingId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Chargement...</div>;
  }

  const flagCountByType = new Map(summary?.openFlagsByType.map(f => [f.type, f.count]) ?? []);

  const missing = summary?.missingRegistersToday ?? [];
  const totalPages = Math.max(1, Math.ceil(missing.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSlots = missing.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Audit & Alertes de Présence</h1>
        <p className="text-xs text-slate-500 mt-1">Vue d'ensemble en temps réel des risques d'assiduité et des registres manquants.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Taux de présence global</p>
            <p className="text-2xl font-extrabold text-[#16212B]">
              {summary?.overallAttendanceRate ? `${summary.overallAttendanceRate}%` : '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Élèves à risque (&lt;80%)</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{summary?.atRiskCount ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Alertes ouvertes</p>
            <p className="text-2xl font-extrabold text-[#16212B]">
              {summary?.openFlagsByType.reduce((sum, f) => sum + f.count, 0) ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Flag className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Registres manquants aujourd'hui</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{summary?.missingRegistersToday.length ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <h2 className="text-sm font-extrabold text-[#16212B] mb-4">Alertes par type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['UNJUSTIFIED_ABSENCE', 'CONSECUTIVE_ABSENCE', 'REPEATED_LATE'] as const).map(type => (
            <div key={type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-semibold text-slate-600">{FLAG_LABELS[type]}</span>
              <Badge variant={flagCountByType.get(type) ? 'danger' : 'neutral'}>{flagCountByType.get(type) ?? 0}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <h2 className="text-sm font-extrabold text-[#16212B] mb-4">Registres manquants aujourd'hui</h2>
        {missing.length === 0
          ? (
              <p className="text-xs text-slate-400 py-6 text-center">Aucun registre manquant — tous les cours programmés aujourd'hui ont une présence enregistrée.</p>
            )
          : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {pagedSlots.map(slot => (
                    <div key={slot.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 px-4 py-3">
                      <div>
                        <p className="text-xs font-bold text-[#16212B]">
                          {slot.className}
                          {' '}
                          -
                          {slot.sectionName}
                          {' '}
                          •
                          {slot.subjectName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {slot.teacherName}
                          {' '}
                          •
                          {slot.startTime}
                          {' '}
                          -
                          {slot.endTime}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendingId === slot.id || sentIds.has(slot.id)}
                        onClick={() => sendReminder(slot.id)}
                        className="h-8 rounded-full px-3 text-[11px] font-bold gap-1.5"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {sentIds.has(slot.id) ? 'Rappel envoyé' : 'Envoyer un rappel'}
                      </Button>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500">{missing.length} registre(s) — page {safePage}/{totalPages}</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 rounded-full px-3 text-[11px] font-bold">Précédent</Button>
                      <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-8 rounded-full px-3 text-[11px] font-bold">Suivant</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
      </Card>
    </div>
  );
}
