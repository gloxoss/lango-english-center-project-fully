'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, User, Wand2, DoorOpen, Users } from 'lucide-react';

type ApiSuggestion = {
  id: string;
  moveSlotId: string;
  kind: 'time' | 'room';
  label: string;
  from: { startTime: string; endTime: string; roomLabel: string | null };
  to: { startTime: string; endTime: string; roomLabel: string | null };
  detail: string;
};

type ApiConflict = {
  type: 'teacher' | 'room' | 'class_section';
  dayOfWeek: string;
  slotA: { id: string; label: string; startTime: string; endTime: string };
  slotB: { id: string; label: string; startTime: string; endTime: string };
  detail: string;
  suggestions?: ApiSuggestion[];
};

const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

const TYPE_ICON: Record<ApiConflict['type'], typeof User> = { teacher: User, room: DoorOpen, class_section: Users };
const TYPE_LABEL: Record<ApiConflict['type'], string> = { teacher: 'Enseignant', room: 'Salle', class_section: 'Classe' };

export function ConflictsView({ locale }: { locale: string }) {
  const [conflicts, setConflicts] = useState<ApiConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const loadConflicts = () => {
    setLoading(true);
    fetch('/api/academics/timetable-conflicts')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setConflicts(json.data);
        }
      })
      .catch(err => console.error('Failed loading conflicts', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  // Applies a suggestion through the shared slot PUT endpoint (school_admin +
  // academics.manage, enforced server-side), then refreshes the conflict list.
  const handleApply = async (s: ApiSuggestion) => {
    setApplyingId(s.id);
    setApplyState(null);
    try {
      const body: Record<string, unknown> = { id: s.moveSlotId };
      if (s.kind === 'time') {
        body.startTime = s.to.startTime;
        body.endTime = s.to.endTime;
      } else {
        body.roomLabel = s.to.roomLabel;
      }
      const res = await fetch('/api/academics/timetable-slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyState({ id: s.id, ok: false, message: json?.message ?? 'Échec de l\'application de la suggestion.' });
        return;
      }
      setApplyState({ id: s.id, ok: true, message: 'Suggestion appliquée.' });
      loadConflicts();
    } catch {
      setApplyState({ id: s.id, ok: false, message: 'Erreur réseau lors de l\'application.' });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Conflits d&apos;emploi du temps</h1>
          <p className="text-xs text-slate-500 mt-1">Double-réservations réelles détectées sur les créneaux enregistrés (enseignant, salle, classe).</p>
        </div>
        <Badge className={conflicts.length > 0 ? 'bg-[#FCE4E2] text-[#E5544B]' : 'bg-[#D1F5E8] text-[#17A673]'}>
          {conflicts.length} conflit(s)
        </Badge>
      </div>

      {!loading && conflicts.length === 0 && (
        <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="text-sm font-bold text-slate-600">Aucun conflit détecté</p>
          <p className="text-xs text-slate-400 max-w-sm">Tous les créneaux de l&apos;emploi du temps sont cohérents.</p>
        </Card>
      )}

      <div className="space-y-3">
        {conflicts.map((c, i) => {
          const Icon = TYPE_ICON[c.type];
          return (
            <Card key={i} className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-rose-100 text-rose-800 text-[10px] gap-1">
                      <Icon className="w-3 h-3" />
                      {TYPE_LABEL[c.type]}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-500">{DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek}</span>
                  </div>
                  <p className="text-xs font-bold text-[#16212B]">{c.detail}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="font-bold text-slate-700">{c.slotA.label}</p>
                      <p className="text-slate-400">{c.slotA.startTime} - {c.slotA.endTime}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="font-bold text-slate-700">{c.slotB.label}</p>
                      <p className="text-slate-400">{c.slotB.startTime} - {c.slotB.endTime}</p>
                    </div>
                  </div>
                  {c.suggestions && c.suggestions.length > 0 && (
                    <div className="p-3 bg-[#EAF1FF] border border-[#D3E3FF] rounded-xl">
                      <div className="flex items-start gap-2">
                        <Wand2 className="w-4 h-4 text-[#0066FF] mt-0.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <p className="text-[11px] font-extrabold text-[#0066FF]">
                            {c.suggestions.length > 1 ? `Suggestions automatiques (${c.suggestions.length})` : 'Suggestion automatique'}
                          </p>
                          {c.suggestions.map((s) => (
                            <div key={s.id} className="p-2.5 bg-white/70 border border-[#D3E3FF] rounded-lg space-y-1.5">
                              <p className="text-[11px] text-slate-600">{s.detail}</p>
                              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                <span className="line-through text-slate-400">{s.from.startTime}–{s.from.endTime}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{s.to.startTime}–{s.to.endTime}</span>
                              </div>
                              {s.kind === 'room' && (
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                  <span className="line-through text-slate-400">Salle {s.from.roomLabel ?? '—'}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>Salle {s.to.roomLabel ?? '—'}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  size="sm"
                                  disabled={applyingId === s.id}
                                  onClick={() => handleApply(s)}
                                >
                                  {applyingId === s.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  Appliquer
                                </Button>
                                {applyState?.id === s.id && (
                                  <span className={`text-[11px] font-bold ${applyState.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{applyState.message}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <Link href={`/${locale}/dashboard/academics/schedule`} className="text-[11px] font-bold text-[#0066FF] hover:underline inline-block pt-1">
                    Résoudre dans l&apos;emploi du temps →
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
