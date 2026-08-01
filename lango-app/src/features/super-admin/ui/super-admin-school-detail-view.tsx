'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

type ApiSchoolDetail = {
  id: string;
  name: string;
  slug: string;
  planTier: 'trial' | 'basic' | 'standard' | 'premium';
  subscriptionStatus: 'active' | 'suspended' | 'cancelled';
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
};

export function SuperAdminSchoolDetailView({ locale, schoolId }: { locale: string; schoolId: string }) {
  const [school, setSchool] = useState<ApiSchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/super-admin/schools?id=${schoolId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'École introuvable.');
        return;
      }
      setSchool(json.data);
    } catch (err) {
      console.error('Failed loading school detail', err);
      setError('Connexion impossible.');
    }
  }

  useEffect(() => {
    load();
  }, [schoolId]);

  async function updateSchool(patch: Partial<Pick<ApiSchoolDetail, 'planTier' | 'subscriptionStatus' | 'isActive'>>) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schoolId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la mise à jour.');
        return;
      }
      setSuccess('École mise à jour.');
      await load();
    } catch (err) {
      console.error('School update failed', err);
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (error || !school) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Link href={`/${locale}/dashboard/super-admin/schools`} className="inline-flex items-center gap-1 text-xs text-[#0066FF] font-bold">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à la liste des écoles
        </Link>
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <Link href={`/${locale}/dashboard/super-admin/schools`} className="inline-flex items-center gap-1 text-xs text-[#0066FF] font-bold mb-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à la liste des écoles</span>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{school.name}</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${school.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {school.isActive ? 'Active' : 'Désactivée'}
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-0.5 font-mono">{school.slug} • Créée le {new Date(school.createdAt).toLocaleDateString('fr-FR')}</p>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Élèves</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.studentCount}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Enseignants</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.teacherCount}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Comptes staff</p>
          <p className="text-xs font-extrabold text-[#0F172A] mt-0.5">{school.staffCount}</p>
        </Card>
      </div>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 max-w-lg">
        <h3 className="text-sm font-extrabold text-[#0F172A]">Gestion de l&apos;abonnement</h3>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Plan tarifaire</label>
          <Select value={school.planTier} onValueChange={v => updateSchool({ planTier: v as ApiSchoolDetail['planTier'] })} disabled={saving}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">Essai</SelectItem>
              <SelectItem value="basic">Basique</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Statut de l&apos;abonnement</label>
          <Select value={school.subscriptionStatus} onValueChange={v => updateSchool({ subscriptionStatus: v as ApiSchoolDetail['subscriptionStatus'] })} disabled={saving}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="suspended">Suspendu</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => updateSchool({ isActive: !school.isActive })}
          className={`w-full text-xs font-bold ${school.isActive ? 'text-rose-600 border-rose-200' : 'text-emerald-600 border-emerald-200'}`}
        >
          {school.isActive ? 'Désactiver cette école' : 'Réactiver cette école'}
        </Button>
      </Card>
    </div>
  );
}
