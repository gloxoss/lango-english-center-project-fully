'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, CheckCircle2, Clock, UploadCloud, AlertCircle } from 'lucide-react';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxScore: string;
};

export function HomeworkView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/academics/assignments')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json?.data) {
          setAssignments(json.data);
        }
      })
      .catch(() => setError('Erreur de chargement des devoirs.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(assignmentId: string) {
    setSubmittingId(assignmentId);
    setMessage(null);

    try {
      // Dummy submission payload for demo
      const res = await fetch('/api/academics/assignments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          studentId: 'current-student',
          fileExt: 'pdf',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setMessage('Devoir soumis avec succès.');
      } else {
        setError(json.message || 'Erreur lors de la soumission.');
      }
    } catch {
      setError('Erreur réseau lors de la soumission.');
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-semibold">Chargement des devoirs...</div>;
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#2487B8]" />
            <span>Mes Devoirs & Exercices</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consultez vos devoirs à rendre et déposez vos travaux en ligne.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {assignments.length === 0 ? (
        <Card className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-extrabold text-[#16212B]">Aucun devoir à rendre</h3>
          <p className="text-xs text-slate-500 mt-1">Vous n'avez aucun devoir en attente pour le moment.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((item) => (
            <Card key={item.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-extrabold text-[#16212B]">{item.title}</h3>
                <span className="px-2 py-0.5 bg-blue-50 text-[#2487B8] rounded-full text-[10px] font-bold">
                  Note max : {item.maxScore}/20
                </span>
              </div>

              {item.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Limite : {new Date(item.dueDate).toLocaleDateString('fr-FR')}</span>
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => handleSubmit(item.id)}
                  disabled={submittingId === item.id}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl h-9 px-4 flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{submittingId === item.id ? 'Soumission...' : 'Rendre mon devoir'}</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
