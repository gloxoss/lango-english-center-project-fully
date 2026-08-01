'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckCircle2, Upload } from 'lucide-react';

const WIZARD_STEPS = [
  { num: 1, label: 'Identité', desc: 'Infos générales' },
  { num: 2, label: 'Cycles & classes', desc: 'Structure pédagogique' },
  { num: 3, label: 'Année scolaire', desc: 'Calendrier académique' },
];

type SettingsForm = {
  establishmentName: string;
  legalStatus: string;
  ice: string;
  directorName: string;
  email: string;
  phone: string;
  city: string;
  academicYear: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: SettingsForm = {
  establishmentName: '',
  legalStatus: '',
  ice: '',
  directorName: '',
  email: '',
  phone: '',
  city: '',
  academicYear: '',
  startDate: '',
  endDate: '',
};

// ponytail: "Cycles & classes" already has real CRUD at dashboard/academics -
// no separate form needed here, this wizard just walks a school_admin
// through the fields that live on schoolSettings. Steps 4/5 (SMS provider,
// student import) from the original mock had no real fields to begin with
// and no corresponding backend yet - dropped rather than kept as dead tabs.
export function SchoolOnboardingView() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [hasLogo, setHasLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [counts, setCounts] = useState<{ totalStudents: number; totalTeachers: number; activeClasses: number } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((json) => {
      if (json.success) {
        setForm({
          establishmentName: json.data.establishmentName ?? '',
          legalStatus: json.data.legalStatus ?? '',
          ice: json.data.ice ?? '',
          directorName: json.data.directorName ?? '',
          email: json.data.email ?? '',
          phone: json.data.phone ?? '',
          city: json.data.city ?? '',
          academicYear: json.data.academicYear ?? '',
          startDate: json.data.startDate ?? '',
          endDate: json.data.endDate ?? '',
        });
      }
    }).catch(err => console.error('Failed loading settings', err));

    fetch('/api/settings/logo').then((res) => { setHasLogo(res.ok); }).catch(() => setHasLogo(false));

    fetch('/api/dashboard/summary').then(r => r.json()).then((json) => {
      if (json.success) {
        setCounts({ totalStudents: json.data.totalStudents, totalTeachers: json.data.totalTeachers, activeClasses: json.data.activeClasses });
      }
    }).catch(err => console.error('Failed loading counts', err));
  }, []);

  function set(field: keyof SettingsForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          email: form.email || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
      }
    } catch (err) {
      console.error('Failed saving settings', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
      if (res.ok) {
        setHasLogo(true);
      }
    } catch (err) {
      console.error('Logo upload failed', err);
    } finally {
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  }

  const progressPct = Math.round((currentStep / WIZARD_STEPS.length) * 100);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Configuration de l&apos;établissement</h1>
        <p className="text-xs text-slate-500 mt-1">Complétez les informations de base pour activer votre espace SchoolOS.</p>
      </div>

      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {WIZARD_STEPS.map((st) => {
            const isActive = currentStep === st.num;
            const isDone = currentStep > st.num;
            return (
              <div
                key={st.num}
                onClick={() => setCurrentStep(st.num)}
                className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${
                  isActive ? 'bg-[#DCEBF4] text-[#1B6C93] font-bold border border-[#2487B8]/40' : isDone ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs ${isActive ? 'bg-[#2487B8] text-white' : isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : st.num}
                </div>
                <div>
                  <p className="font-bold leading-tight">{st.label}</p>
                  <p className="text-[10px] opacity-80 font-normal">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
            {currentStep === 1 && (
              <>
                <h3 className="text-sm font-extrabold text-[#16212B]">Informations générales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nom de l&apos;établissement *</label>
                    <Input value={form.establishmentName} onChange={set('establishmentName')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Statut juridique</label>
                    <Select value={form.legalStatus || undefined} onValueChange={v => setForm(prev => ({ ...prev, legalStatus: v }))}>
                      <SelectTrigger className="w-full h-9 bg-slate-50 rounded-xl text-xs"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SARL">SARL</SelectItem>
                        <SelectItem value="Association">Association</SelectItem>
                        <SelectItem value="Public">Établissement public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Numéro ICE</label>
                    <Input value={form.ice} onChange={set('ice')} className="h-9 text-xs font-mono bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Ville</label>
                    <Input value={form.city} onChange={set('city')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[11px] font-bold text-slate-600">Logo de l&apos;établissement</label>
                  <input ref={logoInputRef} type="file" accept="image/jpeg,image/png" onChange={handleLogoChange} className="hidden" />
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-[#2487B8] font-bold text-2xl overflow-hidden">
                      {hasLogo
                        ? (
                            // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file
                            <img src="/api/settings/logo" alt="Logo" className="w-full h-full object-cover" />
                          )
                        : (form.establishmentName[0] ?? 'S')}
                    </div>
                    <div className="space-y-1">
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-2 rounded-xl text-xs">
                        <Upload className="w-3.5 h-3.5" /> Changer le logo
                      </Button>
                      <p className="text-[10px] text-slate-400">PNG ou JPG. Max 2 Mo.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h4 className="font-extrabold text-[#16212B]">Contact du directeur</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Nom complet</label>
                      <Input value={form.directorName} onChange={set('directorName')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Email</label>
                      <Input value={form.email} onChange={set('email')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Téléphone</label>
                      <Input value={form.phone} onChange={set('phone')} className="h-9 text-xs font-mono bg-slate-50 border-slate-200 rounded-xl" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div className="py-6 text-center space-y-2">
                <p className="text-slate-500">La structure pédagogique (cycles, classes, matières) se configure dans le module Académique.</p>
                <a href="../academics/classes" className="text-[#0066FF] font-bold hover:underline">Aller à Gestion des classes →</a>
              </div>
            )}

            {currentStep === 3 && (
              <>
                <h3 className="text-sm font-extrabold text-[#16212B]">Année scolaire</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Libellé</label>
                    <Input value={form.academicYear} onChange={set('academicYear')} placeholder="Ex. 2025-2026" className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Date de début</label>
                    <Input type="date" value={form.startDate} onChange={set('startDate')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Date de fin</label>
                    <Input type="date" value={form.endDate} onChange={set('endDate')} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" size="md" disabled={currentStep === 1} onClick={() => setCurrentStep(s => Math.max(1, s - 1))} className="rounded-xl px-6">
                Retour
              </Button>
              <div className="flex items-center gap-3">
                {saved && <span className="text-emerald-600 font-bold text-[11px]">Enregistré ✓</span>}
                <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="gap-2 rounded-xl px-6">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 text-xs">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-[#16212B]">Votre progression</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-base border-4 border-[#2487B8]">
                {progressPct}%
              </div>
              <div>
                <p className="font-bold text-[#16212B]">{currentStep} / {WIZARD_STEPS.length} étapes visitées</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-[#16212B]">Aperçu institutionnel</h3>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-[#2487B8] text-white flex items-center justify-center font-bold text-lg overflow-hidden">
                {hasLogo
                  ? (
                      // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file
                      <img src="/api/settings/logo" alt="Logo" className="w-full h-full object-cover" />
                    )
                  : (form.establishmentName[0] ?? 'S')}
              </div>
              <div>
                <p className="font-bold text-[#16212B]">{form.establishmentName || 'Établissement'}</p>
                <p className="text-[10px] text-slate-400">{form.city || 'Ville non renseignée'}</p>
              </div>
            </div>
            {counts && (
              <div className="grid grid-cols-3 gap-2 text-center pt-2 font-extrabold">
                <div className="p-2 bg-slate-50 rounded-lg"><p className="text-slate-400 text-[9px] font-bold">Élèves</p><p className="text-[#2487B8] text-sm">{counts.totalStudents}</p></div>
                <div className="p-2 bg-slate-50 rounded-lg"><p className="text-slate-400 text-[9px] font-bold">Classes</p><p className="text-slate-800 text-sm">{counts.activeClasses}</p></div>
                <div className="p-2 bg-slate-50 rounded-lg"><p className="text-slate-400 text-[9px] font-bold">Enseignants</p><p className="text-slate-800 text-sm">{counts.totalTeachers}</p></div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
