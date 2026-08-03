'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ShieldCheck, GraduationCap, Users, Bell, Save, CheckCircle2 } from 'lucide-react';

export function PoliciesView({ locale: _locale }: { locale: string }) {
  const [autoPromotion, setAutoPromotion] = useState(false);
  const [passThreshold, setPassThreshold] = useState('10');
  const [gradingScale, setGradingScale] = useState('20');
  const [guardianPortal, setGuardianPortal] = useState(true);
  const [studentPortal, setStudentPortal] = useState(true);
  const [absenceNotif, setAbsenceNotif] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Politiques académiques & portails</h1>
          <p className="text-xs text-slate-500 mt-1">Définissez les règles de passage, barèmes et accès aux portails tuteurs et élèves.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 h-10 rounded-full px-5 text-xs font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer les règles'}
        </Button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-[#D1F5E8] border border-[#17A673]/30 rounded-2xl flex items-center gap-3 text-xs font-bold text-[#17A673]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Politiques académiques sauvegardées avec succès.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Academic Rules */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Règles de passage & notation</h3>
              <p className="text-[11px] text-slate-500">Seuils et promotion automatique des élèves</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Promotion automatique</label>
                <p className="text-[10px] text-slate-500">Promouvoir automatiquement les élèves ayant une moyenne ≥ au seuil</p>
              </div>
              <Switch checked={autoPromotion} onCheckedChange={setAutoPromotion} />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Seuil de réussite (Moyenne minimale)</label>
              <Input
                value={passThreshold}
                onChange={(e) => setPassThreshold(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Barème de notation officiel</label>
              <Select value={gradingScale} onValueChange={setGradingScale}>
                <SelectTrigger className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">Note sur 20 (Système Marocain standard)</SelectItem>
                  <SelectItem value="100">Pourcentage / Note sur 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Section 2: Portals & Alerts */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Accès portails & notifications</h3>
              <p className="text-[11px] text-slate-500">Contrôlez les fonctionnalités visibles aux parents et élèves</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Portail tuteurs/parents</label>
                <p className="text-[10px] text-slate-500">Permet d&apos;accéder aux bulletins, absences et solde des frais</p>
              </div>
              <Switch checked={guardianPortal} onCheckedChange={setGuardianPortal} />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Portail élèves</label>
                <p className="text-[10px] text-slate-500">Accès à l&apos;emploi du temps, devoirs et cahier de texte</p>
              </div>
              <Switch checked={studentPortal} onCheckedChange={setStudentPortal} />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Alertes absences SMS automatiques</label>
                <p className="text-[10px] text-slate-500">Notification immédiate au tuteur en cas d&apos;absence non justifiée</p>
              </div>
              <Switch checked={absenceNotif} onCheckedChange={setAbsenceNotif} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
