'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { ArrowLeftRight, CheckCircle2, AlertCircle, Search } from 'lucide-react';

type ApiStudent = { id: string; name: string; email: string; classSectionId: string | null; matricule: string | null };
type ApiClassSection = { id: string; className: string; sectionName: string };

const TRANSFER_TYPES = ['Changement de classe', 'Changement de campus', 'Sortie définitive'] as const;

export function StudentTransfersView() {
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [targetClassSectionId, setTargetClassSectionId] = useState('');
  const [transferType, setTransferType] = useState<typeof TRANSFER_TYPES[number]>('Changement de classe');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    try {
      const [studentsRes, sectionsRes] = await Promise.all([
        fetch('/api/students/transfers'),
        fetch('/api/academics/class-sections?pageSize=100'),
      ]);
      const studentsJson = await studentsRes.json();
      const sectionsJson = await sectionsRes.json();
      if (studentsJson.success) {
        setStudents(studentsJson.data);
      }
      if (sectionsJson.success) {
        setClassSections(sectionsJson.data);
      }
    } catch (err) {
      console.error('Failed loading transfer data', err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const classSectionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const cs of classSections) {
      map.set(cs.id, `${cs.className} ${cs.sectionName}`.trim());
    }
    return map;
  }, [classSections]);

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    return !term || (s.name ?? '').toLowerCase().includes(term) || (s.matricule ?? '').toLowerCase().includes(term);
  });

  async function handleExecuteTransfer() {
    if (!selectedStudentId || !targetClassSectionId) {
      setError('Sélectionnez un élève et une classe de destination.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/students/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          targetClassSectionId,
          transferType,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec du transfert.');
        return;
      }
      setSuccess(json.message || 'Transfert exécuté avec succès.');
      setSelectedStudentId('');
      setTargetClassSectionId('');
      setReason('');
      await loadData();
    } catch (err) {
      console.error('Transfer failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Transferts des élèves</h1>
        <p className="text-xs text-slate-500 mt-1">Changez la classe d&apos;un élève — le transfert s&apos;applique immédiatement.</p>
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

      {/* Transfer form */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 text-xs">
        <h3 className="font-extrabold text-[#16212B]">Créer un transfert</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Élève *</label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-full rounded-xl h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Sélectionnez un élève" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.matricule ? `(${s.matricule})` : ''} — {s.classSectionId ? classSectionLabel.get(s.classSectionId) ?? '—' : 'Non classé'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Nouvelle classe *</label>
            <Select value={targetClassSectionId} onValueChange={setTargetClassSectionId}>
              <SelectTrigger className="w-full rounded-xl h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Sélectionnez une classe" />
              </SelectTrigger>
              <SelectContent>
                {classSections.map(cs => (
                  <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Type de transfert</label>
            <Select value={transferType} onValueChange={v => setTransferType(v as typeof TRANSFER_TYPES[number])}>
              <SelectTrigger className="w-full rounded-xl h-9 bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Motif (optionnel)</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" size="sm" className="gap-2 h-10 rounded-full px-5 text-xs" disabled={saving} onClick={handleExecuteTransfer}>
            <ArrowLeftRight className="w-4 h-4" />
            <span>{saving ? 'Exécution...' : 'Exécuter le transfert'}</span>
          </Button>
        </div>
      </Card>

      {/* Filters */}
      <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un élève par nom ou matricule..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-full"
          />
        </div>
      </div>

      {/* Roster table */}
      <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Élève</th>
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Classe actuelle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 px-4 text-center text-slate-400">Aucun élève trouvé.</td>
                </tr>
              )}
              {filteredStudents.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#16212B] whitespace-nowrap">{s.name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">{s.matricule ?? '—'}</td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">{s.classSectionId ? classSectionLabel.get(s.classSectionId) ?? '—' : 'Non classé'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
