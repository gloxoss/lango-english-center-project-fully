'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  CheckCircle2,
  History,
  Play,
  ScanLine,
  ShieldCheck,
  Square,
  User,
  XCircle,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type GateInfo = {
  id: string;
  gateCode: string;
  gateName: string;
  direction: 'entry' | 'exit' | 'both';
  isActive: boolean;
};

type ShiftInfo = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

type Person = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  subjectType: string;
  label: string;
};

type ScanDirection = 'entry' | 'exit';

type LocalScan = {
  id: string;
  at: Date;
  direction: ScanDirection;
  resultStatus: 'accepted' | 'rejected' | 'already_processed';
  displayName: string | null;
  context: string | null;
};

type Feedback = {
  kind: 'accepted' | 'rejected' | 'already_processed';
  displayName: string;
  message: string;
} | null;

export function GuardScannerView({
  kioskSessionId,
  onSessionChange,
  onForceLock,
}: {
  kioskSessionId: string | null;
  onSessionChange: (id: string | null) => void;
  onForceLock: () => Promise<void>;
}) {
  const [gate, setGate] = useState<GateInfo | null>(null);
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [direction, setDirection] = useState<ScanDirection>('entry');
  const [rawTokenInput, setRawTokenInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [recent, setRecent] = useState<LocalScan[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowedDirections = useCallback((): ScanDirection[] => {
    if (!gate) return ['entry', 'exit'];
    if (gate.direction === 'entry') return ['entry'];
    if (gate.direction === 'exit') return ['exit'];
    return ['entry', 'exit'];
  }, [gate]);

  // Load the guard's assigned gate + shift (authoritative, server-scoped).
  useEffect(() => {
    (async () => {
      setMetaLoading(true);
      setMetaError(null);
      const res = await api<{
        assignment: { deviceId: string | null };
        gate: GateInfo;
        shift: ShiftInfo | null;
      }>('/api/guard/me/shift');
      if (res.ok && res.data) {
        setGate(res.data.gate);
        setShift(res.data.shift ?? null);
        setDeviceId(res.data.assignment.deviceId ?? null);
        const dirs: ScanDirection[] = res.data.gate.direction === 'both' ? ['entry', 'exit'] : [res.data.gate.direction];
        setDirection(dirs[0] ?? 'entry');
      } else {
        setMetaError(res.error?.message ?? 'Aucun portail actif pour ce gardien.');
      }
      setMetaLoading(false);
    })().catch(() => { setMetaLoading(false); setMetaError('Chargement impossible.'); });
  }, []);

  // Keep focus on input for physical scanners.
  useEffect(() => {
    const handleGlobalClick = () => { inputRef.current?.focus(); };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const startSession = async () => {
    if (!gate) return;
    setStarting(true);
    setError(null);
    const res = await api<{ id: string }>('/api/guard/kiosk-sessions', {
      method: 'POST',
      body: JSON.stringify({ gateId: gate.id, deviceId }),
    });
    setStarting(false);
    if (res.ok && res.data?.id) {
      setRecent([]);
      setFeedback(null);
      onSessionChange(res.data.id);
    } else {
      setError(res.error?.message ?? 'Impossible de démarrer la session.');
    }
  };

  const endSession = async () => {
    if (!kioskSessionId) return;
    try {
      await fetch(`/api/guard/kiosk-sessions/${kioskSessionId}/close`, { method: 'POST' });
    } catch {
      // best-effort; scans are already persisted
    }
    onSessionChange(null);
    setFeedback(null);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = rawTokenInput.trim();
    if (!token || !kioskSessionId) return;
    setScanning(true);
    setRawTokenInput('');

    try {
      const res = await api<{
        resultStatus?: string;
        person?: Person | null;
        context?: string | null;
      }>('/api/gate/credentials/verify', {
        method: 'POST',
        body: JSON.stringify({
          kioskSessionId,
          rawToken: token,
          direction,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const resultStatus = res.data?.resultStatus ?? (res.ok ? 'accepted' : 'rejected');
      const person = res.data?.person ?? null;
      const context = res.data?.context ?? null;

      if (res.ok && resultStatus === 'accepted') {
        setFeedback({
          kind: 'accepted',
          displayName: person?.displayName ?? 'Accès autorisé',
          message: context === 'student_pickup'
            ? 'Sortie élève autorisée (bon de retrait actif)'
            : context === 'student_entry'
              ? 'Entrée élève validée'
              : context === 'staff'
                ? 'Accès personnel validé'
                : 'Accès validé',
        });
      } else if (res.ok && resultStatus === 'already_processed') {
        setFeedback({ kind: 'already_processed', displayName: 'Déjà traité', message: 'Ce badge a déjà été scanné.' });
      } else {
        // Uniform minimal-failure response (see /api/gate/credentials/verify).
        setFeedback({ kind: 'rejected', displayName: 'Accès refusé', message: 'Badge non reconnu.' });
      }

      setRecent(prev => [
        {
          id: crypto.randomUUID(),
          at: new Date(),
          direction,
          resultStatus: resultStatus as LocalScan['resultStatus'],
          displayName: person?.displayName ?? null,
          context,
        },
        ...prev,
      ].slice(0, 50));
    } catch {
      setFeedback({ kind: 'rejected', displayName: 'Erreur réseau', message: 'Impossible de contacter le serveur.' });
    } finally {
      setScanning(false);
    }
  };

  const dirs = allowedDirections();
  const acceptedCount = recent.filter(s => s.resultStatus === 'accepted').length;
  const rejectedCount = recent.filter(s => s.resultStatus === 'rejected').length;
  const processedCount = recent.filter(s => s.resultStatus === 'already_processed').length;

  return (
    <div className="space-y-6">
      {/* Shift / gate summary bar */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        {metaLoading ? (
          <p className="text-xs text-slate-500">Chargement de l&apos;affectation…</p>
        ) : metaError || !gate ? (
          <div className="flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4" />
            <span className="font-bold">{metaError ?? 'Aucun portail actif.'}</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[#16212B]">
                {gate.gateName} <span className="font-mono text-xs text-slate-400">{gate.gateCode}</span>
              </p>
              <p className="text-xs text-slate-500">
                {shift ? `${shift.name} · ${shift.startTime} → ${shift.endTime}` : 'Aucun quart associé'}
                {deviceId ? ' · Scanner affecté' : ''}
              </p>
            </div>
            <Badge className="bg-[#DCEBF4] text-[#1B6C93]">
              {gate.direction === 'both' ? 'Entrée & sortie' : gate.direction === 'entry' ? 'Entrée' : 'Sortie'}
            </Badge>
          </div>
        )}
      </Card>

      {/* Session control */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        {kioskSessionId ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <p className="font-extrabold text-[#16212B] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Session active — verrouillage après 60 s d&apos;inactivité
              </p>
              <p className="font-mono text-[11px] mt-0.5">{kioskSessionId.slice(0, 8)}…</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void onForceLock()} className="h-9 text-xs rounded-xl">
                Verrouiller
              </Button>
              <Button
                onClick={() => void endSession()}
                className="h-9 gap-2 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                <Square className="h-3.5 w-3.5" /> Terminer la session
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <p className="font-extrabold text-[#16212B]">Aucune session en cours</p>
              <p className="mt-0.5">Démarrez une session pour scanner les badges sur ce portail.</p>
            </div>
            <Button
              onClick={() => void startSession()}
              disabled={!gate || metaLoading || starting}
              className="h-10 gap-2 rounded-xl px-5 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              <Play className="h-3.5 w-3.5" />
              {starting ? 'Démarrage…' : 'Démarrer la session'}
            </Button>
          </div>
        )}
        {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner form */}
        <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-center min-h-[440px]">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-dashed border-slate-200 bg-slate-50 animate-pulse">
              <ScanLine className="h-10 w-10 text-[#2487B8]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                {kioskSessionId ? 'Prêt à Scanner' : 'Session requise'}
              </h2>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                {kioskSessionId
                  ? 'Présentez le badge QR devant la caméra ou utilisez une douchette USB.'
                  : 'Démarrez une session pour activer le scan sur ce portail.'}
              </p>
            </div>
          </div>

          {/* Direction toggle (big touch targets) */}
          {dirs.length > 1 && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => setDirection('entry')}
                disabled={!kioskSessionId}
                className={`h-14 rounded-2xl text-sm font-extrabold ${
                  direction === 'entry'
                    ? 'bg-[#1B6C93] text-white hover:bg-[#1B6C93]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Entrée
              </Button>
              <Button
                type="button"
                onClick={() => setDirection('exit')}
                disabled={!kioskSessionId}
                className={`h-14 rounded-2xl text-sm font-extrabold ${
                  direction === 'exit'
                    ? 'bg-rose-600 text-white hover:bg-rose-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sortie
              </Button>
            </div>
          )}

          <form onSubmit={handleScan} className="mx-auto mt-8 w-full max-w-sm">
            <div className="relative">
              <Input
                ref={inputRef}
                type="password"
                required
                disabled={!kioskSessionId || scanning}
                value={rawTokenInput}
                onChange={e => setRawTokenInput(e.target.value)}
                placeholder="En attente de scan..."
                className="h-12 rounded-xl border-slate-200 bg-slate-50 text-center font-mono text-sm opacity-50 transition-opacity focus:bg-white focus:opacity-100 focus:ring-2 focus:ring-[#2487B8] disabled:cursor-not-allowed"
                autoFocus
              />
            </div>
          </form>

          {feedback && (
            <div className="mt-8">
              {feedback.kind === 'accepted' ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-extrabold text-emerald-800">{feedback.displayName}</p>
                    <p className="text-xs font-bold text-emerald-600/80">{feedback.message}</p>
                  </div>
                </div>
              ) : feedback.kind === 'already_processed' ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 animate-in zoom-in-95 duration-200">
                  <AlertCircle className="h-8 w-8 shrink-0 text-sky-600" />
                  <div className="text-left">
                    <p className="font-extrabold text-sky-800">{feedback.displayName}</p>
                    <p className="text-xs font-bold text-sky-600/80">{feedback.message}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 animate-in zoom-in-95 duration-200">
                  <XCircle className="h-8 w-8 shrink-0 text-rose-600" />
                  <div className="text-left">
                    <p className="font-extrabold text-rose-800">{feedback.displayName}</p>
                    <p className="text-xs font-bold text-rose-600/80">{feedback.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Recent feed (this session) */}
        <Card className="flex max-h-[600px] flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <History className="h-4 w-4 text-slate-400" /> Flux de la session
            </h3>
            <Badge variant={kioskSessionId ? 'success' : 'neutral'} className="font-mono text-[10px]">
              {recent.length} scans
            </Badge>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
              <p className="text-xl font-extrabold text-emerald-700">{acceptedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600/80">Acceptés</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-center">
              <p className="text-xl font-extrabold text-sky-700">{processedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600/80">Déjà traités</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-center">
              <p className="text-xl font-extrabold text-rose-700">{rejectedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600/80">Refusés</p>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-2">
            {recent.map(scan => (
              <div
                key={scan.id}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  scan.resultStatus === 'accepted'
                    ? 'border-emerald-100 bg-emerald-50/50'
                    : scan.resultStatus === 'already_processed'
                      ? 'border-sky-100 bg-sky-50/50'
                      : 'border-rose-100 bg-rose-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      scan.resultStatus === 'accepted'
                        ? 'bg-emerald-100 text-emerald-600'
                        : scan.resultStatus === 'already_processed'
                          ? 'bg-sky-100 text-sky-600'
                          : 'bg-rose-100 text-rose-600'
                    }`}
                  >
                    {scan.resultStatus === 'rejected' ? <XCircle className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className={`text-xs font-extrabold ${
                      scan.resultStatus === 'accepted'
                        ? 'text-emerald-900'
                        : scan.resultStatus === 'already_processed'
                          ? 'text-sky-900'
                          : 'text-rose-900'
                    }`}>
                      {scan.displayName ?? (scan.resultStatus === 'accepted' ? 'Accès autorisé' : 'Badge inconnu')}
                    </p>
                    <p className={`text-[10px] font-bold ${
                      scan.resultStatus === 'accepted'
                        ? 'text-emerald-600/70'
                        : scan.resultStatus === 'already_processed'
                          ? 'text-sky-600/70'
                          : 'text-rose-600/70'
                    }`}>
                      {scan.resultStatus === 'accepted'
                        ? scan.context === 'student_pickup' ? 'Sortie élève' : scan.context === 'student_entry' ? 'Entrée élève' : scan.context === 'staff' ? 'Personnel' : 'Accès'
                        : scan.resultStatus === 'already_processed' ? 'Déjà traité' : 'Badge non reconnu'}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {scan.direction === 'entry' ? '↑' : '↓'} {scan.at.toLocaleTimeString('fr-FR')}
                </div>
              </div>
            ))}

            {recent.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center space-y-2 pt-12 text-slate-400">
                <ScanLine className="h-8 w-8 opacity-20" />
                <p className="text-xs font-medium">
                  {kioskSessionId ? 'Aucun scan dans cette session.' : 'Démarrez une session pour voir le flux.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
