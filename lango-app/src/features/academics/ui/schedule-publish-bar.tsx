'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Send, Plus, CheckCircle2, AlertTriangle, Copy, ShieldAlert, Sparkles } from 'lucide-react';

interface TimetableVersion {
  id: string;
  sessionYearId: string;
  status: 'draft' | 'published' | 'archived';
  versionNumber: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
}

interface ConflictDetail {
  slotAId: string;
  slotBId: string;
  type: string;
  message: string;
}

export function SchedulePublishBar({
  sessionYearId,
  onVersionChange,
}: {
  sessionYearId?: string;
  onVersionChange?: (versionId: string, status: string) => void;
}) {
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New draft modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string>('none');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Conflict modal
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);

  const loadVersions = async () => {
    if (!sessionYearId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/academics/timetable-versions?sessionYearId=${sessionYearId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setVersions(data.data);
        if (data.data.length > 0 && !selectedVersionId) {
          const published = data.data.find((v: TimetableVersion) => v.status === 'published');
          const activeId = published ? published.id : data.data[0].id;
          const activeStatus = published ? published.status : data.data[0].status;
          setSelectedVersionId(activeId);
          onVersionChange?.(activeId, activeStatus);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [sessionYearId]);

  const activeVersion = versions.find((v) => v.id === selectedVersionId);

  const handleSelectVersion = (id: string) => {
    setSelectedVersionId(id);
    const ver = versions.find((v) => v.id === id);
    if (ver) {
      onVersionChange?.(ver.id, ver.status);
    }
  };

  const handleCreateDraft = async () => {
    if (!sessionYearId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/academics/timetable-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionYearId,
          copiedFromVersionId: copySourceId !== 'none' ? copySourceId : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateModalOpen(false);
        setMessage({ type: 'success', text: `Brouillon v${data.data.versionNumber} créé avec succès.` });
        await loadVersions();
        handleSelectVersion(data.data.id);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Erreur lors de la création.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!sessionYearId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/academics/timetable-versions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionYearId }),
      });
      const data = await res.json();
      if (data.success) {
        const s = data.data;
        const skipped = s.skippedNoTeacher > 0 ? ` · ${s.skippedNoTeacher} matière(s) sans enseignant` : '';
        const unplaced = s.unplaced > 0 ? ` · ${s.unplaced} créneau(x) non placé(s)` : '';
        setMessage({ type: 'success', text: `${s.slotsCreated} créneau(x) généré(s) — v${s.version.versionNumber}${skipped}${unplaced}.` });
        await loadVersions();
        handleSelectVersion(data.data.version.id);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Erreur lors de la génération.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de la génération.' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVersionId) return;
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/academics/timetable-versions/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersionId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Emploi du temps v${data.data.versionNumber} publié avec succès !` });
        await loadVersions();
        onVersionChange?.(data.data.id, 'published');
      } else if (res.status === 409 && data.error?.code === 'TIMETABLE_CONFLICTS_FOUND') {
        setConflicts(data.error?.details?.conflicts || []);
        setConflictModalOpen(true);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Erreur de publication.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de la publication.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-52">
            <Select value={selectedVersionId} onValueChange={handleSelectVersion} disabled={loading}>
              <SelectTrigger className="rounded-xl h-9 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="Sélectionner une version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    Version {v.versionNumber} ({v.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeVersion && (
            <Badge
              variant={activeVersion.status === 'published' ? 'success' : activeVersion.status === 'draft' ? 'warning' : 'neutral'}
              className="text-xs px-2.5 py-1 capitalize"
            >
              {activeVersion.status === 'published' ? 'En Rigueur (Publiée)' : activeVersion.status === 'draft' ? 'Brouillon' : 'Archivée'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || !sessionYearId}
            className="h-9 text-xs rounded-xl gap-1.5 border-slate-200"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2487B8]" />
            {generating ? 'Génération...' : 'Générer automatiquement'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 text-xs rounded-xl gap-1.5 border-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau Brouillon
          </Button>

          {activeVersion && activeVersion.status === 'draft' && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="h-9 text-xs rounded-xl gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93]"
            >
              <Send className="w-3.5 h-3.5" />
              {publishing ? 'Publication...' : 'Publier cette Version'}
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Create Draft Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B]">
              Créer une Nouvelle Version Brouillon
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Vous pouvez démarrer d'une version vierge ou dupliquer une version existante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Source de duplication</label>
              <Select value={copySourceId} onValueChange={setCopySourceId}>
                <SelectTrigger className="rounded-xl h-10 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Vierge (Aucune duplication)</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      Copier depuis Version {v.versionNumber} ({v.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="rounded-xl h-9 text-xs">
              Annuler
            </Button>
            <Button
              onClick={handleCreateDraft}
              disabled={creating}
              className="rounded-xl h-9 text-xs bg-[#2487B8] hover:bg-[#1B6C93]"
            >
              {creating ? 'Création...' : 'Créer le brouillon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflicts Modal */}
      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Conflits Horaires Détectés
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              La publication à échoué car des chevauchements d'horaires sont présents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {conflicts.map((c, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-red-200 text-red-900 inline-block">
                  {c.type}
                </span>
                <p>{c.message || 'Chevauchement de salle, d\'enseignant ou de classe.'}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictModalOpen(false)} className="rounded-xl h-9 text-xs">
              Fermer et Corriger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
