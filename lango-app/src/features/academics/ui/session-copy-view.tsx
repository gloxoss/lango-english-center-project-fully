'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Copy, CheckCircle2, AlertTriangle, Layers, BookOpen, UserCheck } from 'lucide-react';

interface SessionYear {
  id: string;
  name: string;
  isDefault: boolean;
}

interface PreviewSummary {
  sourceSessionName: string;
  targetSessionName: string;
  sourceOfferingsCount: number;
  offeringsToCreateCount: number;
  offeringsSkippedCount: number;
  classSubjectsToCreateCount: number;
  classTeachersToCreateCount: number;
  subjectTeachersToCreateCount: number;
}

interface PreviewClassSubject {
  subjectId: string;
  subjectName: string;
  type: string;
}

interface PreviewClassTeacher {
  teacherId: string;
  teacherName: string;
  role: string;
}

interface PreviewSubjectTeacher {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
}

interface PreviewItem {
  sourceOfferingId: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  capacity: number | null;
  willCreate: boolean;
  classSubjects: PreviewClassSubject[];
  classTeachers: PreviewClassTeacher[];
  subjectTeachers: PreviewSubjectTeacher[];
}

export function SessionCopyView({ locale }: { locale: string }) {
  const [sessions, setSessions] = useState<SessionYear[]>([]);
  const [sourceSessionId, setSourceSessionId] = useState<string>('');
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<Set<string>>(new Set());
  const [commitSuccess, setCommitSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = () => {
    fetch('/api/academics/session-years')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setSessions(res.data);
          const defaultSession = res.data.find((s: SessionYear) => s.isDefault);
          if (defaultSession) {
            setSourceSessionId(defaultSession.id);
            const nextSession = res.data.find((s: SessionYear) => s.id !== defaultSession.id);
            if (nextSession) {
              setTargetSessionId(nextSession.id);
            }
          }
        }
      })
      .catch(() => setError('Impossible de charger la liste des sessions académiques.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCreateNextSession = async () => {
    setError(null);
    try {
      const res = await fetch('/api/academics/session-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
          isDefault: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadSessions();
      } else {
        setError(data.error?.message || 'Erreur lors de la création de la session suivante.');
      }
    } catch {
      setError('Erreur réseau lors de la création de la session.');
    }
  };

  const handlePreview = async () => {
    if (!sourceSessionId || !targetSessionId) {
      setError('Veuillez sélectionner la session source et la session cible.');
      return;
    }
    setError(null);
    setPreviewing(true);
    setCommitSuccess(false);

    try {
      const res = await fetch('/api/academics/class-offerings/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSessionYearId: sourceSessionId,
          targetSessionYearId: targetSessionId,
          mode: 'preview',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.summary);
        const items: PreviewItem[] = Array.isArray(data.items) ? data.items : [];
        setPreviewItems(items);
        setSelectedOfferingIds(new Set(items.map((i) => i.sourceOfferingId)));
      } else {
        setError(data.error?.message || 'Erreur lors de la génération de l\'aperçu.');
      }
    } catch {
      setError('Erreur réseau lors de la génération de l\'aperçu.');
    } finally {
      setPreviewing(false);
    }
  };

  const toggleOffering = (id: string) => {
    setSelectedOfferingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllOfferings = () => {
    setSelectedOfferingIds(new Set(previewItems.map((i) => i.sourceOfferingId)));
  };

  const selectNoOfferings = () => {
    setSelectedOfferingIds(new Set());
  };

  const handleCommit = async () => {
    if (!sourceSessionId || !targetSessionId || !preview) return;
    setError(null);
    setCommitting(true);

    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch('/api/academics/class-offerings/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSessionYearId: sourceSessionId,
          targetSessionYearId: targetSessionId,
          mode: 'commit',
          idempotencyKey,
          offeringIds: Array.from(selectedOfferingIds),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCommitSuccess(true);
        setPreview(null);
        setPreviewItems([]);
        setSelectedOfferingIds(new Set());
      } else {
        setError(data.error?.message || 'Erreur lors de la confirmation de la copie.');
      }
    } catch {
      setError('Erreur réseau lors de la confirmation de la copie.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Copie de Configuration Académique
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dupliquez les offres de classes, matières et enseignants d'une session vers une autre en toute sécurité.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {commitSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          La configuration académique a été copiée avec succès dans la session cible.
        </div>
      )}

      {/* Session Pickers Card */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#16212B]">Sélection des Sessions</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Choisissez la session d'origine dont la structure sera copiée et la session de destination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Source Session */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Session Source (Origine)</label>
              <Select value={sourceSessionId} onValueChange={setSourceSessionId} disabled={loading || previewing}>
                <SelectTrigger className="rounded-xl h-10 border-slate-200">
                  <SelectValue placeholder="Sélectionner la session source" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.isDefault ? '(Actuelle par défaut)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Session */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Session Cible (Destination)</label>
              <Select value={targetSessionId} onValueChange={setTargetSessionId} disabled={loading || previewing}>
                <SelectTrigger className="rounded-xl h-10 border-slate-200">
                  <SelectValue placeholder="Sélectionner la session cible" />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    .filter((s) => s.id !== sourceSessionId)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {sessions.filter((s) => s.id !== sourceSessionId).length === 0 && (
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-xs text-amber-600 font-medium">Aucune session cible trouvée.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateNextSession}
                    className="h-7 text-xs rounded-lg text-[#2487B8] border-[#2487B8] hover:bg-sky-50"
                  >
                    + Créer Session 2026-2027
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handlePreview}
              disabled={!sourceSessionId || !targetSessionId || previewing || loading}
              className="gap-2 h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93]"
            >
              <Copy className="w-4 h-4" />
              {previewing ? 'Génération de l\'aperçu...' : 'Aperçu de la copie'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Result Summary */}
      {preview && (
        <Card className="rounded-2xl border border-[#2487B8]/30 shadow-md bg-gradient-to-br from-white to-slate-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#16212B] flex items-center gap-2">
                  Résumé de l'Aperçu
                  <Badge variant="neutral" className="text-xs border-[#2487B8] text-[#2487B8]">
                    {preview.sourceSessionName} <ArrowRight className="w-3 h-3 inline mx-1" /> {preview.targetSessionName}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Vérifiez les éléments qui seront créés dans la session cible avant de confirmer.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-50 text-[#2487B8]">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-[#16212B]">{preview.offeringsToCreateCount}</p>
                    <p className="text-xs text-slate-500">Offres de classes à créer</p>
                  </div>
                </div>
                {preview.offeringsSkippedCount > 0 && (
                  <p className="text-[11px] text-amber-600 mt-2 font-medium">
                    {preview.offeringsSkippedCount} offres existent déjà (ignorées)
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-[#16212B]">{preview.classSubjectsToCreateCount}</p>
                    <p className="text-xs text-slate-500">Matières assignées</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-[#16212B]">{preview.classTeachersToCreateCount}</p>
                    <p className="text-xs text-slate-500">Enseignants titulaires</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-[#16212B]">{preview.subjectTeachersToCreateCount}</p>
                    <p className="text-xs text-slate-500">Affectations enseignants-matières</p>
                  </div>
                </div>
              </div>
            </div>

            {previewItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#16212B] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0066FF]" />
                    Aperçu détaillé — {selectedOfferingIds.size}/{previewItems.length} offre(s) sélectionnée(s)
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllOfferings}
                      className="h-7 text-xs rounded-lg"
                    >
                      Tout sélectionner
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectNoOfferings}
                      className="h-7 text-xs rounded-lg"
                    >
                      Tout désélectionner
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {previewItems.map((item) => {
                    const checked = selectedOfferingIds.has(item.sourceOfferingId);
                    return (
                      <label
                        key={item.sourceOfferingId}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          checked
                            ? 'border-[#0066FF]/40 bg-blue-50/40'
                            : 'border-slate-200 bg-white opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOffering(item.sourceOfferingId)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#16212B]">
                              {item.className} — {item.sectionName}
                            </span>
                            {item.capacity != null && (
                              <Badge variant="neutral" className="text-[11px]">
                                {item.capacity} places
                              </Badge>
                            )}
                            {item.willCreate ? (
                              <Badge variant="neutral" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                Nouvelle
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                                Existe déjà
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>{item.classSubjects.length} matière(s)</span>
                            <span>{item.classTeachers.length} enseignant(s) titulaire(s)</span>
                            <span>{item.subjectTeachers.length} affectation(s) matière</span>
                          </div>
                          {item.classSubjects.length > 0 && (
                            <p className="text-[11px] text-slate-400 mt-1 truncate">
                              {item.classSubjects.map((s) => s.subjectName).join(', ')}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">
                    Voir le JSON complet de l'aperçu
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] overflow-x-auto">
                    {JSON.stringify(previewItems, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                {selectedOfferingIds.size} offre(s) seront copiées. Cette opération est transactionnelle et n'affectera pas la session source.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPreview(null)}
                  disabled={committing}
                  className="h-9 text-xs rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCommit}
                  disabled={committing || selectedOfferingIds.size === 0}
                  className="gap-2 h-9 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {committing ? 'Copie en cours...' : 'Confirmer la copie'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
