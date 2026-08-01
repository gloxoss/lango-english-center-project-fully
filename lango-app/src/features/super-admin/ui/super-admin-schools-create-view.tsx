'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Copy } from 'lucide-react';

export function SuperAdminSchoolsCreateView({ locale }: { locale: string }) {
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planTier, setPlanTier] = useState<'trial' | 'basic' | 'standard' | 'premium'>('trial');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tempPassword: string; adminEmail: string } | null>(null);

  async function handleCreate() {
    if (!name || !adminName || !adminEmail) {
      setError('Nom de l\'école, nom et email de l\'administrateur sont requis.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, adminName, adminEmail, planTier }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la création.');
        return;
      }
      setResult({ tempPassword: json.data.tempPassword, adminEmail: json.data.adminEmail });
    } catch (err) {
      console.error('School create failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>École créée avec succès</span>
          </div>
          <p className="text-xs text-slate-600">
            Communiquez ces identifiants à l&apos;administrateur — le mot de passe temporaire ne sera plus affiché ensuite.
          </p>
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-bold text-[#16212B]">{result.adminEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mot de passe temporaire</span>
              <span className="font-bold text-[#16212B] flex items-center gap-1.5">
                {result.tempPassword}
                <button onClick={() => navigator.clipboard.writeText(result.tempPassword)} title="Copier"><Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button>
              </span>
            </div>
          </div>
          <Link href={`/${locale}/dashboard/super-admin/schools`}>
            <Button variant="primary" className="w-full">Retour à la liste des écoles</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Créer une école</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Provisionner un nouveau tenant et son premier administrateur.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-base font-extrabold text-[#0F172A]">Informations générales</h3>
        <div>
          <label className="text-xs font-bold text-slate-700">Nom de l&apos;école *</label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 text-xs" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700">Plan tarifaire</label>
          <Select value={planTier} onValueChange={v => setPlanTier(v as typeof planTier)}>
            <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">Essai</SelectItem>
              <SelectItem value="basic">Basique</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <h3 className="text-base font-extrabold text-[#0F172A] pt-4 border-t border-slate-100">Administrateur principal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Nom complet *</label>
            <Input value={adminName} onChange={e => setAdminName(e.target.value)} className="mt-1 text-xs" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Email *</label>
            <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="mt-1 text-xs" />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button disabled={saving} onClick={handleCreate} className="bg-[#0066FF] text-white gap-2 text-xs font-bold px-6 h-10 rounded-xl">
            {saving ? 'Création...' : 'Créer l\'école'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
