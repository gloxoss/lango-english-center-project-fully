'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Send, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

type ApiClassSection = { id: string; classId: string; className: string; sectionName: string };
type ApiSubject = { id: string; name: string };
type ApiClassSubject = { id: string; classId: string; subjectId: string };
type ApiAssessmentPlan = { id: string; name: string; classSubjectId: string };
type ApiAssessmentSession = { id: string; title: string; assessmentDate: string; assessmentPlanId: string };
type ApiStudent = { id: string; fullName: string };
type ApiGradeResult = { studentId: string; score: string | number; feedback: string | null };

export function GradeEntryView() {
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [sessions, setSessions] = useState<ApiAssessmentSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSession, setNewSession] = useState({ title: '', assessmentDate: new Date().toISOString().slice(0, 10) });

  const [roster, setRoster] = useState<ApiStudent[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()),
      fetch('/api/academics/subjects?pageSize=200').then(r => r.json()),
      fetch('/api/academics/class-subjects?pageSize=500').then(r => r.json()),
    ]).then(([csJson, subjJson, classSubjJson]) => {
      if (csJson.success) setClassSections(csJson.data);
      if (subjJson.success) setSubjects(subjJson.data);
      if (classSubjJson.success) setClassSubjects(classSubjJson.data);
    }).catch(err => console.error('Failed loading grade-entry pickers', err));
  }, []);

  const selectedClassSection = classSections.find(c => c.id === selectedClassSectionId) ?? null;
  const classSubjectId = useMemo(() => {
    if (!selectedClassSection || !selectedSubjectId) {
      return null;
    }
    return classSubjects.find(cs => cs.classId === selectedClassSection.classId && cs.subjectId === selectedSubjectId)?.id ?? null;
  }, [selectedClassSection, selectedSubjectId, classSubjects]);

  // Once a class+subject resolve to a real classSubjectId, find-or-create the
  // (single, default) assessment plan for it, then load its sessions.
  useEffect(() => {
    setSessions([]);
    setSelectedSessionId('');
    if (!classSubjectId) {
      return;
    }
    async function loadOrCreatePlanAndSessions() {
      try {
        const plansRes = await fetch(`/api/academics/assessment-plans?classSubjectId=${classSubjectId}`);
        const plansJson = await plansRes.json();
        let plan: ApiAssessmentPlan | undefined = plansJson.success ? plansJson.data[0] : undefined;

        if (!plan) {
          const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name ?? 'Évaluations';
          const createRes = await fetch('/api/academics/assessment-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: subjectName, classSubjectId }),
          });
          const createJson = await createRes.json();
          if (createJson.success) {
            plan = createJson.data;
          }
        }

        if (plan) {
          const sessionsRes = await fetch(`/api/academics/assessment-sessions?assessmentPlanId=${plan.id}`);
          const sessionsJson = await sessionsRes.json();
          if (sessionsJson.success) {
            setSessions(sessionsJson.data);
          }
        }
      } catch (err) {
        console.error('Failed loading assessment plan/sessions', err);
      }
    }
    loadOrCreatePlanAndSessions();
  }, [classSubjectId, selectedSubjectId, subjects]);

  // Load roster + existing grades once a class and a specific assessment are chosen.
  useEffect(() => {
    setScores({});
    setFeedback({});
    setAbsent({});
    if (!selectedClassSectionId || !selectedSessionId) {
      setRoster([]);
      return;
    }
    async function loadRosterAndGrades() {
      try {
        const [studentsRes, gradesRes] = await Promise.all([
          fetch(`/api/students?classSectionId=${selectedClassSectionId}&pageSize=200`),
          fetch(`/api/academics/assessments?assessmentId=${selectedSessionId}`),
        ]);
        const studentsJson = await studentsRes.json();
        const gradesJson = await gradesRes.json();
        if (studentsJson.success) {
          setRoster(studentsJson.data);
        }
        if (gradesJson.success) {
          const nextScores: Record<string, string> = {};
          const nextFeedback: Record<string, string> = {};
          for (const g of gradesJson.data as ApiGradeResult[]) {
            nextScores[g.studentId] = String(g.score);
            nextFeedback[g.studentId] = g.feedback ?? '';
          }
          setScores(nextScores);
          setFeedback(nextFeedback);
        }
      } catch (err) {
        console.error('Failed loading roster/grades', err);
      }
    }
    loadRosterAndGrades();
  }, [selectedClassSectionId, selectedSessionId]);

  async function handleCreateSession() {
    if (!classSubjectId) {
      return;
    }
    const plansRes = await fetch(`/api/academics/assessment-plans?classSubjectId=${classSubjectId}`);
    const plansJson = await plansRes.json();
    const planId = plansJson.data?.[0]?.id;
    if (!planId || !newSession.title) {
      setError('Titre requis.');
      return;
    }
    try {
      const res = await fetch('/api/academics/assessment-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentPlanId: planId, title: newSession.title, assessmentDate: newSession.assessmentDate }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la création.');
        return;
      }
      setSessions(prev => [...prev, json.data]);
      setSelectedSessionId(json.data.id);
      setIsNewSessionOpen(false);
      setNewSession({ title: '', assessmentDate: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      console.error('Session create failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    }
  }

  async function handleSaveGrades() {
    if (!selectedSessionId) {
      return;
    }
    const grades = roster
      .filter(s => !absent[s.id] && scores[s.id])
      .map(s => ({ studentId: s.id, score: Number.parseFloat(scores[s.id]!), ...(feedback[s.id] ? { feedback: feedback[s.id] } : {}) }));
    if (grades.length === 0) {
      setError('Saisissez au moins une note.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/academics/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: selectedSessionId, grades }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de l\'enregistrement.');
        return;
      }
      setSuccess(json.message || 'Notes enregistrées avec succès.');
    } catch (err) {
      console.error('Grade save failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  const enteredCount = roster.filter(s => !absent[s.id] && scores[s.id]).length;
  const numericScores = roster.filter(s => !absent[s.id] && scores[s.id]).map(s => Number.parseFloat(scores[s.id]!)).filter(n => !Number.isNaN(n));
  const average = numericScores.length > 0 ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length) : null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Saisie des notes</h1>
          <p className="text-xs text-slate-500 mt-1">Saisissez et enregistrez les notes pour une évaluation.</p>
        </div>
        <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4" disabled={saving || !selectedSessionId} onClick={handleSaveGrades}>
          <Send className="w-4 h-4" />
          <span>{saving ? 'Enregistrement...' : 'Enregistrer les notes'}</span>
        </Button>
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

      {/* Pickers */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center gap-3">
        <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
          <SelectTrigger className="w-[180px] rounded-full h-9 bg-white">
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent>
            {classSections.map(cs => <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="w-[160px] rounded-full h-9 bg-white">
            <SelectValue placeholder="Matière" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {classSubjectId && (
          <>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-[160px] rounded-full h-9 bg-white">
                <SelectValue placeholder="Évaluation" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-full px-3 text-xs" onClick={() => setIsNewSessionOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Nouvelle évaluation
            </Button>
          </>
        )}
        {selectedClassSectionId && selectedSubjectId && !classSubjectId && (
          <span className="text-xs text-amber-600 font-semibold">Cette matière n&apos;est pas assignée à cette classe.</span>
        )}
      </div>

      {/* Quick stats */}
      {selectedSessionId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <p className="text-[10px] font-bold text-slate-400">Moyenne</p>
            <p className="text-xl font-extrabold text-[#16212B]">{average !== null ? `${average.toFixed(2)} /20` : '—'}</p>
          </Card>
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <p className="text-[10px] font-bold text-slate-400">Notes saisies</p>
            <p className="text-xl font-extrabold text-[#16212B]">{enteredCount} / {roster.length}</p>
          </Card>
        </div>
      )}

      {/* Grade table */}
      {selectedSessionId && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4">Note /20</th>
                  <th className="py-3 px-4">Absent</th>
                  <th className="py-3 px-4">Commentaire (optionnel)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {roster.length === 0 && (
                  <tr><td colSpan={4} className="py-8 px-4 text-center text-slate-400">Aucun élève dans cette classe.</td></tr>
                )}
                {roster.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#16212B]">{st.fullName}</td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.25"
                        disabled={!!absent[st.id]}
                        value={scores[st.id] ?? ''}
                        onChange={e => setScores(prev => ({ ...prev, [st.id]: e.target.value }))}
                        className="w-20 px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-center font-extrabold text-xs focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 disabled:opacity-40"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={!!absent[st.id]}
                        onChange={e => setAbsent(prev => ({ ...prev, [st.id]: e.target.checked }))}
                        className="rounded"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={feedback[st.id] ?? ''}
                        onChange={e => setFeedback(prev => ({ ...prev, [st.id]: e.target.value }))}
                        placeholder="Ajouter un commentaire..."
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouvelle évaluation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre *</label>
              <Input value={newSession.title} onChange={e => setNewSession({ ...newSession, title: e.target.value })} placeholder="Ex. Contrôle 2" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date</label>
              <Input type="date" value={newSession.assessmentDate} onChange={e => setNewSession({ ...newSession, assessmentDate: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewSessionOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleCreateSession} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
