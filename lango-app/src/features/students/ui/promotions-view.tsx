'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { GraduationCap, AlertCircle, CheckCircle2, Users, Search, ArrowRight, CheckSquare, Square } from 'lucide-react';

type ApiStudent = { id: string; fullName: string; matricule: string | null };
type ApiClassSection = { id: string; className: string; sectionName: string };

export function PromotionsView() {
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [roster, setRoster] = useState<ApiStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/academics/class-sections?pageSize=100')
      .then(res => res.json())
      .then((json) => { if (json.success) setClassSections(json.data); })
      .catch(err => console.error('Failed loading class sections', err));
  }, []);

  useEffect(() => {
    if (!sourceId) {
      setRoster([]);
      return;
    }
    fetch(`/api/students?classSectionId=${sourceId}&pageSize=200`)
      .then(res => res.json())
      .then((json) => {
        if (json.success) {
          setRoster(json.data);
          setSelectedIds(new Set(json.data.map((s: ApiStudent) => s.id)));
        }
      })
      .catch(err => console.error('Failed loading source roster', err));
  }, [sourceId]);

  const classSectionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const cs of classSections) {
      map.set(cs.id, `${cs.className} ${cs.sectionName}`.trim());
    }
    return map;
  }, [classSections]);

  const filteredRoster = useMemo(() => {
    return roster.filter((s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.matricule ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roster, searchQuery]);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handlePromote() {
    if (!sourceId || !targetId) {
      setError('Sélectionnez une classe source et une classe de destination.');
      return;
    }
    if (sourceId === targetId) {
      setError('La classe de destination doit être différente de la classe source.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Sélectionnez au moins un élève à promouvoir.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/students/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceClassSectionId: sourceId,
          targetClassSectionId: targetId,
          studentIds: [...selectedIds],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la promotion.');
        return;
      }
      setSuccess(json.message || 'Promotion exécutée avec succès.');
      setRoster([]);
      setSourceId('');
      setTargetId('');
    } catch (err) {
      console.error('Promotion failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Promotions de fin d&apos;année</h1>
        <p className="text-xs text-slate-500 mt-1">Promouvoir les élèves d&apos;une classe vers une autre en un lot</p>
      </div>

      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Classes configurées</p>
            <p className="text-xl font-extrabold text-[#16212B]">{classSections.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Prêtes pour promotion</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Élèves en classe source</p>
            <p className="text-xl font-extrabold text-[#16212B]">{roster.length}</p>
            <p className="text-[10px] font-semibold text-amber-700">Effectif chargé</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Élèves sélectionnés</p>
            <p className="text-xl font-extrabold text-[#16212B]">{selectedIds.size}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Prêts à promouvoir</p>
          </div>
        </Card>
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

      {/* Class selectors */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Classe actuelle (Source) *</label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-full rounded-xl h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Sélectionnez la classe actuelle" />
              </SelectTrigger>
              <SelectContent>
                {classSections.map(cs => (
                  <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Nouvelle classe (Destination) *</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="w-full rounded-xl h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Sélectionnez la nouvelle classe" />
              </SelectTrigger>
              <SelectContent>
                {classSections.map(cs => (
                  <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Roster */}
      {sourceId && (
        <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#16212B]">
              {roster.length} élève(s) dans {classSectionLabel.get(sourceId) ?? 'cette classe'}
            </span>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un élève..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
              <span className="text-xs text-slate-500 font-bold">{selectedIds.size} sélectionné(s)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={roster.length > 0 && selectedIds.size === roster.length}
                      onChange={() => setSelectedIds(selectedIds.size === roster.length ? new Set() : new Set(roster.map(s => s.id)))}
                      className="rounded"
                    />
                  </th>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4">Matricule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRoster.length === 0 && (
                  <tr><td colSpan={3} className="py-8 px-4 text-center text-slate-400">Aucun élève trouvé.</td></tr>
                )}
                {filteredRoster.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded" /></td>
                    <td className="py-3 px-4 font-bold text-[#16212B]">{s.fullName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.matricule ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          className="gap-2 rounded-xl px-6 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs"
          disabled={saving || !sourceId || !targetId || selectedIds.size === 0}
          onClick={handlePromote}
        >
          <GraduationCap className="w-4 h-4" />
          <span>{saving ? 'Promotion en cours...' : `Promouvoir ${selectedIds.size || ''} élève(s)`}</span>
        </Button>
      </div>
    </div>
  );
}
