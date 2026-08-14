'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HeartHandshake, AlertTriangle } from 'lucide-react';

type MyListing = { isActive: boolean; offering: string; contactPreference: string | null } | null;
type BrowseEntry = { id: string; name: string; offering: string; contactPreference: string | null };

export default function AlumniMentoringPage() {
  const [myListing, setMyListing] = useState<MyListing>(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ isActive: false, offering: '', contactPreference: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [browse, setBrowse] = useState<BrowseEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/alumni/me/mentoring').then(r => r.json()).then((j) => {
      if (j?.success) {
        setMyListing(j.data);
        if (j.data) setForm({ isActive: j.data.isActive, offering: j.data.offering, contactPreference: j.data.contactPreference ?? '' });
      }
      setLoaded(true);
    });
    fetch('/api/alumni/mentoring').then(r => r.json()).then(j => j?.success && setBrowse(j.data));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/alumni/me/mentoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Échec de l\'enregistrement.');
        return;
      }
      setMyListing(json.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Mentorat</h1>

      <div>
        <h2 className="text-sm font-extrabold text-[#16212B] mb-3">Mon offre</h2>
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {loaded && (
            <>
              <textarea
                placeholder="Ce que vous proposez (conseils carrière, relecture CV, découverte d'un secteur...)"
                value={form.offering}
                onChange={e => setForm({ ...form, offering: e.target.value })}
                rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
              />
              <input
                placeholder="Préférence de contact (email, LinkedIn...)"
                value={form.contactPreference}
                onChange={e => setForm({ ...form, contactPreference: e.target.value })}
                className="w-full h-9 text-xs border border-slate-200 rounded-xl px-3"
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" />
                Apparaître dans la liste des mentors
              </label>
              <Button size="sm" disabled={saving || !form.offering.trim()} onClick={handleSave} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-[#16212B] mb-3">Parcourir</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {browse === null && <p className="text-xs text-slate-400">Chargement...</p>}
          {browse !== null && browse.length === 0 && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs col-span-full flex flex-col items-center justify-center gap-3 text-center">
              <HeartHandshake className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Aucun mentor disponible pour le moment</p>
            </Card>
          )}
          {browse?.map(m => (
            <Card key={m.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-sm font-extrabold text-[#16212B]">{m.name}</p>
              <p className="text-xs text-slate-600 mt-1">{m.offering}</p>
              {m.contactPreference && <p className="text-[10px] text-slate-400 mt-1.5">Contact : {m.contactPreference}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
