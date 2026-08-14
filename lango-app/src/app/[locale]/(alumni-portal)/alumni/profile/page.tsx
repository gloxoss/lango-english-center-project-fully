'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

type Profile = { name: string; email: string; phone: string | null; cohortName: string | null };
type Consent = { showName: boolean; showCohort: boolean; showCurrentEmployer: boolean; showContactInfo: boolean; currentEmployer: string | null; isEligible: boolean };

export default function AlumniProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editFields, setEditFields] = useState({ email: '', phone: '' });
  const [consent, setConsent] = useState<Consent | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = () => {
    fetch('/api/alumni/me/profile').then(r => r.json()).then((j) => {
      if (j?.success) {
        setProfile(j.data);
        setEditFields({ email: j.data.email ?? '', phone: j.data.phone ?? '' });
      }
    });
  };
  const loadConsent = () => {
    fetch('/api/alumni/me/preferences').then(r => r.json()).then(j => j?.success && setConsent(j.data));
  };

  useEffect(() => { loadProfile(); loadConsent(); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/alumni/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editFields) });
      loadProfile();
    } finally {
      setSaving(false);
    }
  };

  const toggleConsent = async (field: keyof Consent, value: boolean) => {
    setConsent(prev => (prev ? { ...prev, [field]: value } : prev));
    await fetch('/api/alumni/me/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
  };

  const saveEmployer = async (value: string) => {
    setConsent(prev => (prev ? { ...prev, currentEmployer: value } : prev));
    await fetch('/api/alumni/me/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentEmployer: value }) });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Mon profil</h1>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-[#16212B]">Coordonnées</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
            <Input value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} className="h-9 rounded-xl text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Téléphone</label>
            <Input value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} className="h-9 rounded-xl text-xs" />
          </div>
        </div>
        <Button size="sm" disabled={saving} onClick={saveProfile} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </Card>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-[#16212B]">Visibilité dans l&apos;annuaire</h3>
        {consent && !consent.isEligible && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Vous n&apos;êtes pas encore éligible à l&apos;annuaire ou au mentorat (réservé aux 18 ans et plus). Ces préférences seront appliquées automatiquement une fois éligible.</span>
          </div>
        )}
        {consent && (
          <div className="space-y-3 text-xs">
            {([
              ['showName', 'Afficher mon nom'],
              ['showCohort', 'Afficher ma promotion'],
              ['showCurrentEmployer', 'Afficher mon employeur actuel'],
              ['showContactInfo', 'Afficher mes coordonnées'],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 font-semibold text-slate-600">
                <input type="checkbox" checked={consent[field]} onChange={e => toggleConsent(field, e.target.checked)} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
            {consent.showCurrentEmployer && (
              <Input placeholder="Employeur actuel" defaultValue={consent.currentEmployer ?? ''} onBlur={e => saveEmployer(e.target.value)} className="h-9 rounded-xl text-xs max-w-xs" />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
