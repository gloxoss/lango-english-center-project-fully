'use client';

import React, { useEffect, useState } from 'react';
import { Sliders, ShieldCheck, CheckCircle, Bell, Loader2, AlertTriangle } from 'lucide-react';

type TransportPolicies = {
  maxCapacityMarginPercent: number;
  requireSafeHandoffYoungerStudents: boolean;
  handoffAgeThresholdYears: number;
};

const DEFAULTS: TransportPolicies = {
  maxCapacityMarginPercent: 0,
  requireSafeHandoffYoungerStudents: false,
  handoffAgeThresholdYears: 8,
};

export default function TransportPoliciesPage() {
  const [policies, setPolicies] = useState<TransportPolicies>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/transport/policies');
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) {
          setPolicies({
            maxCapacityMarginPercent: json.data.maxCapacityMarginPercent ?? 0,
            requireSafeHandoffYoungerStudents: json.data.requireSafeHandoffYoungerStudents ?? false,
            handoffAgeThresholdYears: json.data.handoffAgeThresholdYears ?? 8,
          });
        } else {
          setError(json.error?.message || 'Impossible de charger les politiques.');
        }
      } catch {
        if (!cancelled) setError('Impossible de joindre le serveur.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/transport/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(json.error?.message || 'Erreur lors de l\'enregistrement.');
      }
    } catch {
      setError('Impossible de joindre le serveur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-7 h-7 text-[#0066FF]" />
            Règles & Politiques de Transport
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configuration des contrôles de sécurité, remise des jeunes élèves et limites de capacité.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Politiques enregistrées avec succès.</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 text-base">
              <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
              Capacité des Véhicules
            </h2>

            <div className="py-2">
              <label className="font-semibold text-slate-800 text-sm block mb-1">Marge de surcapacité autorisée (%)</label>
              <span className="text-xs text-slate-500 block mb-1">Autorise un dépassement temporaire de la capacité assise lors de l'affectation.</span>
              <input
                type="number"
                min={0}
                max={100}
                value={policies.maxCapacityMarginPercent}
                onChange={e => setPolicies({ ...policies, maxCapacityMarginPercent: Number(e.target.value) })}
                className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 text-base">
              <Bell className="w-5 h-5 text-[#0066FF]" />
              Remise Sécurisée des Jeunes Élèves
            </h2>

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-semibold text-slate-800 text-sm block">Remise sécurisée obligatoire pour les jeunes élèves</span>
                <span className="text-xs text-slate-500">Exiger un adulte responsable à la dépose pour les élèves sous le seuil d'âge.</span>
              </div>
              <input
                type="checkbox"
                checked={policies.requireSafeHandoffYoungerStudents}
                onChange={e => setPolicies({ ...policies, requireSafeHandoffYoungerStudents: e.target.checked })}
                className="w-4 h-4 text-[#0066FF] rounded border-slate-300 focus:ring-[#0066FF]"
              />
            </div>

            <div className="py-2 border-t">
              <label className="font-semibold text-slate-800 text-sm block mb-1">Âge seuil de remise sécurisée (années)</label>
              <input
                type="number"
                min={0}
                max={18}
                value={policies.handoffAgeThresholdYears}
                onChange={e => setPolicies({ ...policies, handoffAgeThresholdYears: Number(e.target.value) })}
                className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0066FF] hover:bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les Politiques'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
