'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ScanLine, CheckCircle2, AlertCircle, XCircle, ShieldCheck, User,
  History, Play, Square, Sparkles, Layers, SlidersHorizontal,
  Volume2, VolumeX, Smartphone, Monitor, ShieldAlert, Users,
  Camera, RefreshCw, Keyboard, ArrowRight, Clock, AlertTriangle,
  QrCode, Check, Bell, Flame
} from 'lucide-react';
import { AttendanceScannerKiosk } from './attendance-scanner-kiosk';

type ScanEvent = {
  id: string;
  scannedAt: string;
  resultStatus: 'accepted' | 'rejected' | 'already_scanned';
  rejectionReason?: string | null;
  stagedStatus?: 'present' | 'late' | null;
  studentName: string;
  matricule: string;
  className: string;
  guardianName?: string;
  avatarUrl?: string;
};

const DEFAULT_DEMO_SCANS: ScanEvent[] = [
  { id: 'sc-1', scannedAt: '08:24:12', resultStatus: 'accepted', stagedStatus: 'present', studentName: 'Yasmine Benjelloun', matricule: 'ETU-2025-0042', className: '2ème Bac Sciences Maths - A', guardianName: 'M. Karim Benjelloun (Père)' },
  { id: 'sc-2', scannedAt: '08:26:45', resultStatus: 'accepted', stagedStatus: 'present', studentName: 'Mehdi El Amrani', matricule: 'ETU-2025-0118', className: '1ère Bac Sciences Ex - B', guardianName: 'Mme. Amina El Amrani (Mère)' },
  { id: 'sc-3', scannedAt: '08:34:02', resultStatus: 'accepted', stagedStatus: 'late', studentName: 'Omar Berrada', matricule: 'ETU-2025-0210', className: 'Tronc Commun Scientifique - 1', guardianName: 'M. Rachid Berrada (Père)' },
  { id: 'sc-4', scannedAt: '08:37:18', resultStatus: 'rejected', rejectionReason: 'Badge Révoqué / Non Enregistré', studentName: 'Badge Inconnu (#TOKEN-994)', matricule: 'ERR-INVALID', className: 'Non assigné' },
];

export function AttendanceScannerPlayground({ locale = 'fr' }: { locale?: string }) {
  const [activeTab, setActiveTab] = useState<'standard' | 'variation-a' | 'variation-b' | 'variation-c'>('variation-a');

  // Scanner States
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<ScanEvent | null>(DEFAULT_DEMO_SCANS[0] ?? null);
  const [scanHistory, setScanHistory] = useState<ScanEvent[]>(DEFAULT_DEMO_SCANS);

  // Variation B (Teacher Handheld) Manual Keypad fallback
  const [keypadInput, setKeypadInput] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);

  // Variation C (Security Desk) Lockdown & Muster count
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);
  const [insideHeadcount, setInsideHeadcount] = useState(342);

  // Simulate instant scan action for testing
  const triggerSimulatedScan = (type: 'present' | 'late' | 'invalid' | 'already') => {
    let newEvent: ScanEvent;
    const now = new Date().toLocaleTimeString('fr-FR', { hour12: false });

    if (type === 'present') {
      newEvent = {
        id: `sc-${Date.now()}`,
        scannedAt: now,
        resultStatus: 'accepted',
        stagedStatus: 'present',
        studentName: 'Kenza Tazi',
        matricule: 'ETU-2025-0095',
        className: '1ère Bac Sciences Ex - A',
        guardianName: 'Mme. Samira Tazi (Mère)',
      };
    } else if (type === 'late') {
      newEvent = {
        id: `sc-${Date.now()}`,
        scannedAt: now,
        resultStatus: 'accepted',
        stagedStatus: 'late',
        studentName: 'Anas Bennani',
        matricule: 'ETU-2025-0155',
        className: 'Tronc Commun Littéraire - 2',
        guardianName: 'M. Tarik Bennani (Père)',
      };
    } else {
      newEvent = {
        id: `sc-${Date.now()}`,
        scannedAt: now,
        resultStatus: 'rejected',
        rejectionReason: 'Badge Expiré ou Invalide',
        studentName: 'QR Non Reconnu',
        matricule: 'ERR-INVALID',
        className: 'Non reconnu',
      };
    }

    setLastScan(newEvent);
    setScanHistory(prev => [newEvent, ...prev]);
    if (newEvent.resultStatus === 'accepted') {
      setInsideHeadcount(prev => prev + 1);
    }
  };

  const handleKeypadSubmit = () => {
    if (!keypadInput) return;
    triggerSimulatedScan('present');
    setKeypadInput('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Playground Header & Variation Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                <Sparkles className="w-3.5 h-3.5" /> Design Exploration (Bucket 5 - §8.3)
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactif · 3 Variations</span>
            </div>
            <h1 className="text-xl font-bold text-[#16212B] mt-1.5 tracking-tight">
              Poste & Borne de Pointage Présence QR / Badge
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparez les 3 interfaces : Borne Tablette Hall d&apos;Entrée, Mode Mobile Enseignant, et Poste Sécurité & Contrôle d&apos;Accès.
            </p>
          </div>

          {/* Interactive Variation Tabs */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('variation-a')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-a'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Var. A : Borne Tablette / Kiosk</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-b')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-b'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Var. B : Mobile Enseignant & Clavier</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-c')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-c'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Var. C : Poste Sécurité & Tuteurs</span>
            </button>
            <button
              onClick={() => setActiveTab('standard')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'standard'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Vue Standard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Quick Action Toolbar */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-600 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-[#2487B8]" />
          Simulateur de Scan Rapide :
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => triggerSimulatedScan('present')}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Scan Présent (À l&apos;heure)
          </Button>
          <Button
            size="sm"
            onClick={() => triggerSimulatedScan('late')}
            className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl gap-1"
          >
            <Clock className="w-3.5 h-3.5" /> Scan En Retard (+15 min)
          </Button>
          <Button
            size="sm"
            onClick={() => triggerSimulatedScan('invalid')}
            className="h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-1"
          >
            <XCircle className="w-3.5 h-3.5" /> Scan Invalide / Rejeté
          </Button>
        </div>
      </div>

      {/* VARIATION A: KIOSK / TABLET MODE (STATIONARY ENTRANCE SCANNER) */}
      {activeTab === 'variation-a' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Viewfinder Column */}
            <div className="lg:col-span-7">
              <Card className="h-full min-h-[460px] p-6 bg-slate-950 text-white rounded-3xl border-slate-800 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-xs text-emerald-400 font-bold uppercase tracking-wider">
                      Borne Entrée Principale (En Ligne)
                    </span>
                  </div>

                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                {/* Animated Camera / Viewfinder Box */}
                <div className="my-auto py-8 flex flex-col items-center justify-center relative">
                  <div className="w-64 h-64 border-2 border-[#2487B8]/70 rounded-3xl relative flex items-center justify-center bg-[#2487B8]/5 backdrop-blur-xs">
                    {/* Viewfinder Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#0EA5C4] rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#0EA5C4] rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#0EA5C4] rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#0EA5C4] rounded-br-xl" />

                    {/* Animated Scanning Laser Line */}
                    <div className="absolute left-4 right-4 h-0.5 bg-[#0EA5C4] shadow-[0_0_12px_#0EA5C4] animate-bounce" />

                    <QrCode className="w-24 h-24 text-white/30" />
                  </div>
                  <p className="mt-4 text-xs font-semibold text-slate-400 text-center">
                    Présentez votre badge élève ou carte NFC devant la caméra
                  </p>
                </div>

                {/* Live Ticker Bar at Bottom */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Pointages aujourd&apos;hui : <strong className="text-white">342</strong></span>
                  <span>À l&apos;heure : <strong className="text-emerald-400">328 (96%)</strong></span>
                  <span>Retards : <strong className="text-amber-400">14</strong></span>
                </div>
              </Card>
            </div>

            {/* Instant Splash Card Column */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="h-full p-6 bg-white rounded-3xl border border-slate-200/90 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Dernier Pointage Validé
                  </h3>

                  {lastScan ? (
                    <div className="mt-6 space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#2487B8] text-white font-bold flex items-center justify-center text-xl shadow-md">
                          {lastScan.studentName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-[#16212B]">{lastScan.studentName}</h4>
                          <p className="text-xs text-slate-500 font-mono">{lastScan.matricule}</p>
                          <p className="text-xs text-[#2487B8] font-semibold mt-0.5">{lastScan.className}</p>
                        </div>
                      </div>

                      {/* Status Splash Indicator */}
                      <div className={`p-4 rounded-2xl flex items-center gap-3 ${
                        lastScan.resultStatus === 'accepted'
                          ? lastScan.stagedStatus === 'present'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                          : 'bg-rose-50 border border-rose-200 text-rose-800'
                      }`}>
                        {lastScan.resultStatus === 'accepted' ? (
                          lastScan.stagedStatus === 'present' ? (
                            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-7 h-7 text-amber-600 shrink-0" />
                          )
                        ) : (
                          <XCircle className="w-7 h-7 text-rose-600 shrink-0" />
                        )}

                        <div>
                          <p className="font-bold text-sm">
                            {lastScan.resultStatus === 'accepted'
                              ? lastScan.stagedStatus === 'present'
                                ? 'ENTRÉE VALIDÉE — À L\'HEURE'
                                : 'RETARD NOTIFIÉ (+15 MIN)'
                              : 'ACCÈS REFUSÉ / BADGE INCONNU'}
                          </p>
                          <p className="text-xs opacity-80 mt-0.5">Pointé à {lastScan.scannedAt}</p>
                        </div>
                      </div>

                      {lastScan.guardianName && (
                        <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-200/60">
                          <p><span className="text-slate-400">Tuteur Légal :</span> <strong className="text-slate-800">{lastScan.guardianName}</strong></p>
                          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Confirmation WhatsApp délivrée en direct
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      En attente de pointage...
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    SchoolOS Hardware Gateway v2.4
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* VARIATION B: TEACHER HANDHELD / MOBILE MODE */}
      {activeTab === 'variation-b' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Mobile Viewfinder & Roll Call Gauge */}
            <Card className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#2487B8]" />
                  <h3 className="font-bold text-xs text-[#16212B]">Mode Smartphone Enseignant</h3>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[10px]">
                  En Ligne
                </Badge>
              </div>

              {/* Progress Roll Call Meter */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Appel 1ère Bac Sc. Ex - B :</span>
                  <span className="text-[#2487B8]">24 / 28 élèves pointés (85%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2487B8] rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div className="h-48 bg-slate-900 rounded-2xl relative flex items-center justify-center overflow-hidden">
                <Camera className="w-12 h-12 text-white/30" />
                <div className="absolute inset-4 border border-dashed border-[#0EA5C4] rounded-xl flex items-center justify-center text-[10px] text-white/60">
                  Cibler le QR badge de l&apos;élève
                </div>
              </div>

              <Button
                onClick={() => triggerSimulatedScan('present')}
                className="w-full h-10 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 shadow-xs"
              >
                <ScanLine className="w-4 h-4" /> Déclencher le Scan Caméra
              </Button>
            </Card>

            {/* Manual Matricule Keypad Fallback */}
            <Card className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-slate-700" />
                  <h3 className="font-bold text-xs text-[#16212B]">Saisie Manuelle (Sans Badge)</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Secours</span>
              </div>

              <div className="space-y-3">
                <Input
                  value={keypadInput}
                  onChange={e => setKeypadInput(e.target.value)}
                  placeholder="Tapez le N° matricule..."
                  className="h-10 text-center font-mono font-bold text-sm tracking-widest rounded-xl border-slate-200"
                />

                {/* Simulated Numeric Keypad Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === 'C') setKeypadInput('');
                        else if (key === 'OK') handleKeypadSubmit();
                        else setKeypadInput(prev => prev + key);
                      }}
                      className={`h-10 rounded-xl font-bold text-xs transition-all ${
                        key === 'OK'
                          ? 'bg-[#2487B8] text-white'
                          : key === 'C'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* VARIATION C: RECEPTION & SECURITY DESK COMMAND CENTER */}
      {activeTab === 'variation-c' && (
        <div className="space-y-6">
          {/* Top Emergency / Fire Drill Muster Bar */}
          <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
            emergencyLockdown
              ? 'bg-rose-600 text-white'
              : 'bg-[#16212B] text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
                {emergencyLockdown ? <Flame className="w-5 h-5 text-amber-300 animate-pulse" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {emergencyLockdown ? 'ALERTE CONFINEMENT / ÉVACUATION INCENDIE' : 'Poste Central de Contrôle & Sécurité Établissement'}
                </h3>
                <p className="text-xs text-white/70">
                  Comptage instantané des personnes présentes dans l&apos;enceinte scolaire : <strong className="text-white">{insideHeadcount} personnes</strong>
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setEmergencyLockdown(!emergencyLockdown)}
              className={`h-9 text-xs font-bold rounded-xl gap-2 ${
                emergencyLockdown
                  ? 'bg-white text-rose-700 hover:bg-slate-100'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {emergencyLockdown ? 'Lever le Confinement' : 'Déclencher Alerte Sécurité'}
            </Button>
          </div>

          {/* Split Screen Feeds */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Live Gate Feed & Guardian Pickup Check */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Contrôle des Tuteurs & Sorties / Pickups
                  </h3>
                  <Badge variant="neutral" className="text-[10px]">Portail Sud</Badge>
                </div>

                <div className="p-4 bg-[#2487B8]/5 border border-[#2487B8]/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#2487B8] uppercase">Tuteur Autorisé</span>
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[10px]">Identité Vérifiée</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 font-bold flex items-center justify-center text-slate-700">
                      KB
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#16212B]">M. Karim Benjelloun</h4>
                      <p className="text-xs text-slate-500">CIN : BE49201 · Tuteur de : Yasmine Benjelloun (2ème Bac)</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Real-Time Event Audit Stream */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Journal des Événements d&apos;Accès
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Flux direct</span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
                  {scanHistory.map(item => (
                    <div key={item.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#16212B]">{item.studentName}</p>
                        <p className="text-[10px] text-slate-400">{item.className} · {item.scannedAt}</p>
                      </div>
                      <Badge className={`text-[9px] border-none ${
                        item.resultStatus === 'accepted'
                          ? item.stagedStatus === 'present'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-amber-500/15 text-amber-700'
                          : 'bg-rose-500/15 text-rose-700'
                      }`}>
                        {item.resultStatus === 'accepted' ? (item.stagedStatus === 'present' ? 'Présent' : 'Retard') : 'Refusé'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD BASELINE VIEW */}
      {activeTab === 'standard' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <AttendanceScannerKiosk />
        </div>
      )}
    </div>
  );
}
