'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Globe,
  Users,
  MessageSquare,
  Lock,
  ExternalLink,
  Info,
  Save,
} from 'lucide-react';

export function SettingsView({ locale }: { locale: string }) {
  const [establishmentName, setEstablishmentName] = useState('Groupe scolaire Atlas');
  const [city, setCity] = useState('Casablanca');
  const [address, setAddress] = useState('123, Boulevard Abdelmoumen, Casablanca 20340');
  const [phone, setPhone] = useState('+212 522 12 34 56');
  const [email, setEmail] = useState('contact@atlas.ma');

  const [academicYear, setAcademicYear] = useState('2024 - 2025');
  const [startDate, setStartDate] = useState('2024-09-01');
  const [endDate, setEndDate] = useState('2025-06-30');
  const [allowOperations, setAllowOperations] = useState(true);

  // Presence Toggles
  const [presenceModes, setPresenceModes] = useState({
    presence: true,
    retard: true,
    absenceJustifiee: true,
    absenceNonJustifiee: true,
    sortieAnticipee: true,
  });

  // Languages Checkboxes
  const [languages, setLanguages] = useState({
    francais: true,
    arabe: true,
    anglais: false,
  });

  // Security Toggles
  const [security, setSecurity] = useState({
    twoFa: true,
    strongPassword: true,
    auditLog: true,
    autoBackup: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setEstablishmentName(json.data.establishmentName || 'Groupe scolaire Atlas');
            setCity(json.data.city || 'Casablanca');
            setAddress(json.data.address || '');
            setPhone(json.data.phone || '');
            setEmail(json.data.email || '');
            setAcademicYear(json.data.academicYear || '2024 - 2025');
          }
        }
      } catch (err) {
        console.error('Failed loading settings', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentName,
          city,
          address,
          phone,
          email,
          academicYear,
          startDate,
          endDate,
          allowOperations,
          presenceModes,
          languages,
          security,
        }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title & Top Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Paramètres & conformité</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les paramètres de votre établissement et suivez votre conformité CNDP.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 h-10 rounded-full px-5 text-xs font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-[#D1F5E8] border border-[#17A673]/30 rounded-2xl flex items-center gap-3 text-xs font-bold text-[#17A673]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Paramètres enregistrés avec succès dans le système.</span>
        </div>
      )}

      {/* Bento Grid: 3 Columns Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Section 1: Informations de l'établissement */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#16212B]">Informations de l&apos;établissement</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Nom de l&apos;établissement</label>
              <Input
                value={establishmentName}
                onChange={(e) => setEstablishmentName(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Ville</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Adresse</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Téléphone de contact</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Email officiel</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Année scolaire active */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#16212B]">Année scolaire active</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Année en cours</label>
              <Input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Date début</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Date fin</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-bold text-slate-700">Opérations autorisées</span>
                <input
                  type="checkbox"
                  checked={allowOperations}
                  onChange={(e) => setAllowOperations(e.target.checked)}
                  className="w-4 h-4 accent-[#0066FF] rounded"
                />
              </label>
              <p className="text-[10px] text-slate-500">Saisie des notes, présences et facturation actives.</p>
            </div>
          </div>
        </Card>

        {/* Section 3: Statut CNDP F211 */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D1F5E8] text-[#17A673] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Statut CNDP F211</h3>
                <p className="text-[11px] text-slate-500">Protection des données personnelles</p>
              </div>
            </div>

            <div className="p-4 bg-[#D1F5E8]/40 border border-[#17A673]/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[#17A673] font-extrabold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dossier F211 Déposé & Valide</span>
              </div>
              <p className="text-[11px] text-slate-600">Récépissé N° <strong>CNDP-2024-8891</strong> accordé le 12 Fév 2024.</p>
            </div>
          </div>

          <Link href={`/${locale}/dashboard/settings/cndp`}>
            <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-bold border-slate-200 gap-2">
              <span>Consulter le statut CNDP</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </Card>
      </div>

      {/* Section 4: Security & Compliance Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-xs font-bold text-[#16212B]">Langues du portail</h3>
          </div>
          <div className="space-y-2 text-xs">
            {Object.entries(languages).map(([lang, val]) => (
              <label key={lang} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-none cursor-pointer">
                <span className="capitalize font-semibold text-slate-700">{lang}</span>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setLanguages({ ...languages, [lang]: e.target.checked })}
                  className="w-4 h-4 accent-[#0066FF] rounded"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-xs font-bold text-[#16212B]">Gestion des utilisateurs</h3>
          </div>
          <p className="text-xs text-slate-500">Gérez les permissions, réinitialisez les accès et attribuez les rôles aux comptes.</p>
          <Link href={`/${locale}/dashboard/settings/users`}>
            <Button variant="outline" className="w-full text-xs font-bold rounded-xl h-9 text-[#0066FF] border-[#0066FF]/30">
              Ouvrir le gestionnaire d&apos;utilisateurs
            </Button>
          </Link>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-xs font-bold text-[#16212B]">Sécurité & conformité</h3>
          </div>
          <div className="space-y-2 text-xs">
            {Object.entries(security).map(([secKey, secVal]) => (
              <label key={secKey} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-none cursor-pointer">
                <span className="font-semibold text-slate-700 capitalize">{secKey}</span>
                <input
                  type="checkbox"
                  checked={secVal}
                  onChange={(e) => setSecurity({ ...security, [secKey]: e.target.checked })}
                  className="w-4 h-4 accent-[#0066FF] rounded"
                />
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Global Callout Bar */}
      <div className="p-4 bg-[#DCEBF4]/50 border border-[#0066FF]/20 rounded-2xl flex items-center gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-[#0066FF] shrink-0" />
        <p>Tous les paramètres sont appliqués immédiatement et sauvegardés en base de données.</p>
      </div>
    </div>
  );
}
