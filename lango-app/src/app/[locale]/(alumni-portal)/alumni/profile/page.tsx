'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Profile = { name: string; email: string; phone: string | null; cohortName: string | null };
type Consent = { showName: boolean; showCohort: boolean; showCurrentEmployer: boolean; showContactInfo: boolean; currentEmployer: string | null; isEligible: boolean };

export default function AlumniProfilePage() {
  const tCommon = useTranslations('Common');
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

  useEffect(() => {
    loadProfile(); loadConsent();
  }, []);

  // Every save here used to ignore the response. For the consent switches that
  // meant the screen could show a visibility choice (Law 09-08) the server never
  // recorded, so failures now revert the switch and say so.
  const send = async (url: string, method: 'PATCH' | 'PUT', body: unknown): Promise<boolean> => {
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        toast.error(json?.error?.message || json?.message || tCommon('error'));
        return false;
      }
      return true;
    } catch {
      toast.error(tCommon('networkError'));
      return false;
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      if (await send('/api/alumni/me/profile', 'PATCH', editFields)) {
        toast.success(tCommon('success'));
      }
      loadProfile();
    } finally {
      setSaving(false);
    }
  };

  const toggleConsent = async (field: keyof Consent, value: boolean) => {
    const previous = consent?.[field];
    setConsent(prev => (prev ? { ...prev, [field]: value } : prev));
    if (!(await send('/api/alumni/me/preferences', 'PUT', { [field]: value }))) {
      setConsent(prev => (prev ? { ...prev, [field]: previous } as Consent : prev));
    }
  };

  const saveEmployer = async (value: string) => {
    if (value === (consent?.currentEmployer ?? '')) {
      return;
    }
    const previous = consent?.currentEmployer ?? null;
    setConsent(prev => (prev ? { ...prev, currentEmployer: value } : prev));
    if (!(await send('/api/alumni/me/preferences', 'PUT', { currentEmployer: value }))) {
      setConsent(prev => (prev ? { ...prev, currentEmployer: previous } : prev));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Mon profil</h1>

      <Card className="
        space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
      "
      >
        <h3 className="text-sm font-extrabold text-[#16212B]">Coordonnées</h3>
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
        "
        >
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
            <Input
              value={editFields.email}
              readOnly
              title="Contactez l'établissement pour changer l'email de connexion"
              className="h-9 rounded-xl bg-slate-50 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Téléphone</label>
            <Input
              value={editFields.phone}
              onChange={e => setEditFields({ ...editFields, phone: e.target.value })}
              className="h-9 rounded-xl text-xs"
            />
          </div>
        </div>
        <Button
          size="sm"
          disabled={saving}
          onClick={saveProfile}
          className="
            h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
            hover:bg-[#1B6C93]
          "
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </Card>

      <Card className="
        space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
      "
      >
        <h3 className="text-sm font-extrabold text-[#16212B]">Visibilité dans l&apos;annuaire</h3>
        {consent && !consent.isEligible && (
          <div className="
            flex items-start gap-2 rounded-xl border border-amber-200
            bg-amber-50 p-3 text-xs font-semibold text-amber-700
          "
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
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
              <label
                key={field}
                className="flex items-center gap-2 font-semibold text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={consent[field]}
                  onChange={e => toggleConsent(field, e.target.checked)}
                  className="rounded-sm border-slate-300"
                />
                {label}
              </label>
            ))}
            {consent.showCurrentEmployer && (
              <Input
                placeholder="Employeur actuel"
                defaultValue={consent.currentEmployer ?? ''}
                onBlur={e => saveEmployer(e.target.value)}
                className="h-9 max-w-xs rounded-xl text-xs"
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
