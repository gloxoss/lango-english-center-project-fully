'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  User,
  History,
  Play,
  Square,
} from 'lucide-react';

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
};

type ScanEvent = {
  id: string;
  scannedAt: string;
  resultStatus: 'accepted' | 'rejected' | 'already_scanned';
  rejectionReason: string | null;
  stagedStatus: 'present' | 'late' | null;
  studentId: string | null;
  studentName: string | null;
};

type LiveFeedback = {
  name: string;
  status: 'accepted' | 'rejected' | 'already_scanned';
  message: string;
  scannedAt: Date;
} | null;

export function AttendanceScannerKiosk() {
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [rawTokenInput, setRawTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [feedback, setFeedback] = useState<LiveFeedback>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeSession = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await fetch(`/api/attendance/qr/scanner-sessions/${id}/close`, { method: 'POST' });
    } catch {
      // session close is best-effort; scan events are already persisted
    }
  }, []);

  // Fetch the roster of class-sections on mount (teacher-scoped server-side).
  useEffect(() => {
    fetch('/api/academics/class-sections')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setSections(json.data || []);
        }
      })
      .catch(() => {});
  }, []);

  // Close the session when the operator navigates away or unmounts.
  useEffect(() => {
    return () => {
      closeSession(sessionIdRef.current);
    };
  }, [closeSession]);

  // Keep focus on input for physical scanners.
  useEffect(() => {
    const handleGlobalClick = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Poll the session's live scan feed while it is active.
  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/attendance/qr/scanner-sessions/${sessionId}/events`);
        const json = await res.json();
        if (json.success) {
          setEvents(json.data || []);
        }
      } catch {
        // transient network hiccup — next tick retries
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const startSession = async () => {
    if (!selectedSectionId) return;
    try {
      setStarting(true);
      setError(null);
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: selectedSectionId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Impossible de démarrer la session.');
        return;
      }
      setSessionId(json.data.id);
      sessionIdRef.current = json.data.id;
      setEvents([]);
    } catch {
      setError('Erreur réseau lors du démarrage de la session.');
    } finally {
      setStarting(false);
    }
  };

  const endSession = async () => {
    const id = sessionIdRef.current;
    await closeSession(id);
    setSessionId(null);
    sessionIdRef.current = null;
    setFeedback(null);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTokenInput.trim() || !sessionId) return;
    setSubmitting(true);

    const scannedToken = rawTokenInput.trim();
    setRawTokenInput(''); // Clear immediately for next scan

    try {
      const res = await fetch('/api/attendance/qr/verify-and-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: scannedToken,
          sessionId,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const resultStatus = json.data?.resultStatus || 'accepted';
        const stagedStatus = json.data?.stagedStatus;
        setFeedback({
          name: json.data?.student?.name || 'Élève inconnu',
          status: resultStatus,
          message: resultStatus === 'already_scanned'
            ? 'Déjà scanné — présence déjà enregistrée'
            : stagedStatus === 'late' ? 'Présence validée (retard)' : 'Présence validée',
          scannedAt: new Date(),
        });
      } else {
        setFeedback({
          name: 'Rejeté',
          status: 'rejected',
          message: json.error?.message || json.message || 'Erreur de scan',
          scannedAt: new Date(),
        });
      }
    } catch (err) {
      setFeedback({
        name: 'Erreur réseau',
        status: 'rejected',
        message: 'Impossible de contacter le serveur',
        scannedAt: new Date(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const acceptedCount = events.filter(ev => ev.resultStatus === 'accepted').length;
  const rejectedCount = events.filter(ev => ev.resultStatus === 'rejected').length;
  const alreadyScannedCount = events.filter(ev => ev.resultStatus === 'already_scanned').length;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs text-center sm:text-left">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0 mx-auto sm:mx-0">
            <ScanLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Kiosque Scanner Élèves
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Scan continu des badges QR pour enregistrer la présence.
            </p>
          </div>
        </div>

        {sessionId ? (
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs mx-auto sm:mx-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Session Active</span>
          </Badge>
        ) : (
          <Badge variant="neutral" className="font-bold gap-1 px-3 py-1.5 text-xs mx-auto sm:mx-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kiosque Sécurisé</span>
          </Badge>
        )}
      </div>

      {/* Session setup / status bar */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        {sessionId ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <p className="font-extrabold text-[#16212B]">
                Session en cours — classe : {sections.find(s => s.id === selectedSectionId)?.className} {sections.find(s => s.id === selectedSectionId)?.sectionName}
              </p>
              <p className="text-[11px] font-mono mt-0.5">Session {sessionId.slice(0, 8)}...</p>
            </div>
            <Button
              onClick={endSession}
              className="gap-2 h-9 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              <Square className="w-3.5 h-3.5" />
              Terminer la session
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Classe / section à scanner</label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:bg-white focus:ring-2 focus:ring-[#2487B8] focus:border-[#2487B8] outline-none"
              >
                <option value="">Sélectionner une classe...</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.className} — {s.sectionName}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={startSession}
              disabled={!selectedSectionId || starting}
              className="gap-2 h-10 text-xs rounded-xl px-5 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              <Play className="w-3.5 h-3.5" />
              {starting ? 'Démarrage...' : 'Démarrer la session'}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Form */}
        <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl mx-auto flex items-center justify-center relative animate-pulse">
              <ScanLine className="w-10 h-10 text-[#2487B8]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                {sessionId ? 'Prêt à Scanner' : 'Session requise'}
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                {sessionId
                  ? 'Présentez votre badge QR devant la caméra ou utilisez une douchette USB.'
                  : 'Démarrez une session de scan pour une classe avant de présenter les badges.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleScan} className="mt-8 max-w-sm mx-auto w-full">
            <div className="relative">
              <Input
                ref={inputRef}
                type="password"
                required
                disabled={!sessionId}
                value={rawTokenInput}
                onChange={(e) => setRawTokenInput(e.target.value)}
                placeholder="En attente de scan..."
                className="text-center text-sm font-mono h-12 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#2487B8] focus:border-[#2487B8] opacity-50 focus:opacity-100 transition-opacity disabled:cursor-not-allowed"
                autoFocus
              />
            </div>
          </form>

          {/* Large feedback for the most recent scan */}
          {feedback && (
            <div className="mt-8">
              {feedback.status === 'accepted' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-emerald-800 font-extrabold">{feedback.name}</p>
                    <p className="text-emerald-600/80 font-bold text-xs">{feedback.message}</p>
                  </div>
                </div>
              ) : feedback.status === 'already_scanned' ? (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in-95 duration-200">
                  <AlertCircle className="w-8 h-8 text-sky-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-sky-800 font-extrabold">{feedback.name}</p>
                    <p className="text-sky-600/80 font-bold text-xs">{feedback.message}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in-95 duration-200">
                  <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-rose-800 font-extrabold">Rejeté</p>
                    <p className="text-rose-600/80 font-bold text-xs">{feedback.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Live feed + counters */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col h-full max-h-[600px]">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Flux en direct</span>
            </h3>
            {sessionId ? (
              <Badge variant="success" className="font-mono text-[10px]">
                {events.length} scans
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-slate-500 font-mono text-[10px]">
                {events.length} scans
              </Badge>
            )}
          </div>

          {/* Live counters */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-xl font-extrabold text-emerald-700">{acceptedCount}</p>
              <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wide">Acceptés</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-center">
              <p className="text-xl font-extrabold text-sky-700">{alreadyScannedCount}</p>
              <p className="text-[10px] font-bold text-sky-600/80 uppercase tracking-wide">Déjà scannés</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
              <p className="text-xl font-extrabold text-rose-700">{rejectedCount}</p>
              <p className="text-[10px] font-bold text-rose-600/80 uppercase tracking-wide">Rejetés</p>
            </div>
          </div>

          <div className="overflow-y-auto pr-2 space-y-2 flex-1">
            {events.map((scan) => (
              <div
                key={scan.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                  scan.resultStatus === 'accepted'
                    ? 'bg-emerald-50/50 border-emerald-100'
                    : scan.resultStatus === 'already_scanned'
                      ? 'bg-sky-50/50 border-sky-100'
                      : 'bg-rose-50/50 border-rose-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    scan.resultStatus === 'accepted'
                      ? 'bg-emerald-100 text-emerald-600'
                      : scan.resultStatus === 'already_scanned'
                        ? 'bg-sky-100 text-sky-600'
                        : 'bg-rose-100 text-rose-600'
                  }`}>
                    {scan.resultStatus === 'rejected' ? <AlertCircle className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className={`text-xs font-extrabold ${
                      scan.resultStatus === 'accepted'
                        ? 'text-emerald-900'
                        : scan.resultStatus === 'already_scanned'
                          ? 'text-sky-900'
                          : 'text-rose-900'
                    }`}>
                      {scan.studentName || 'Élève inconnu'}
                    </p>
                    <p className={`text-[10px] font-bold ${
                      scan.resultStatus === 'accepted'
                        ? 'text-emerald-600/70'
                        : scan.resultStatus === 'already_scanned'
                          ? 'text-sky-600/70'
                          : 'text-rose-600/70'
                    }`}>
                      {scan.resultStatus === 'accepted'
                        ? scan.stagedStatus === 'late' ? 'Présence (retard)' : 'Présence validée'
                        : scan.resultStatus === 'already_scanned'
                          ? 'Déjà scanné'
                          : scan.rejectionReason || 'Rejeté'}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {new Date(scan.scannedAt).toLocaleTimeString('fr-FR')}
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 pt-12">
                <ScanLine className="w-8 h-8 opacity-20" />
                <p className="text-xs font-medium">
                  {sessionId ? 'Aucun scan pour cette session.' : 'Démarrez une session pour voir le flux.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
