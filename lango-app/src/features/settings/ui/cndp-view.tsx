'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

type FilingData = {
  id: string;
  filingReference: string | null;
  filedAt: string | null;
  status: 'draft' | 'submitted' | 'approved';
  notes: string | null;
};

export function CndpComplianceView() {
  const [filing, setFiling] = useState<FilingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [filedAt, setFiledAt] = useState('');
  const [status, setStatus] = useState<'draft' | 'submitted' | 'approved'>('draft');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/settings/cndp-filing')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json?.data) {
          const d: FilingData = json.data;
          setFiling(d);
          setReference(d.filingReference || '');
          setFiledAt(d.filedAt || '');
          setStatus(d.status);
          setNotes(d.notes || '');
        }
      })
      .catch(() => setError('Impossible de charger les données CNDP.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings/cndp-filing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filingReference: reference,
          filedAt: filedAt || undefined,
          status,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Erreur lors de l\'enregistrement.');
        return;
      }

      setFiling(json.data);
      setSuccess('Déclaration CNDP enregistrée avec succès.');
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-xs font-semibold">Chargement des données de conformité CNDP...</div>;
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#2487B8]" />
            <span>Conformité CNDP (Loi 09-08)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion du récépissé de déclaration de traitement des données personnelles (Formulaire F211).
          </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs lg:col-span-2 space-y-4">
          <h3 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2487B8]" />
            <span>Enregistrer ou Mettre à Jour le Récépissé F211</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Référence du Récépissé CNDP</Label>
              <Input
                type="text"
                placeholder="ex: D-W-12345/2026"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Date de Dépôt / Approbation</Label>
                <Input
                  type="date"
                  value={filedAt}
                  onChange={(e) => setFiledAt(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Statut du Dossier</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#2487B8]"
                >
                  <option value="draft">Brouillon / En préparation</option>
                  <option value="submitted">Déposé à la CNDP</option>
                  <option value="approved">Approuvé / Récépissé obtenu</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Notes & Remarques</Label>
              <textarea
                rows={3}
                placeholder="Remarques complémentaires..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#2487B8]"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl px-5 h-10">
                {saving ? 'Enregistrement...' : 'Enregistrer la Déclaration'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-[#16212B]">Statut de Conformité</h3>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Référence :</span>
              <span className="font-mono font-bold text-[#16212B]">{filing?.filingReference || 'Aucun récépissé'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Statut actuel :</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                filing?.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                filing?.status === 'submitted' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {filing?.status === 'approved' ? 'Conforme / Récépissé' : filing?.status === 'submitted' ? 'En cours' : 'Non déposé'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
