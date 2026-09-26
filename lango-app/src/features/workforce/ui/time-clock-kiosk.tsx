'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  QrCode,
} from 'lucide-react';

interface PunchItem {
  id: string;
  employeeName?: string | null;
  employeeId: string;
  punchType: 'in' | 'out';
  scannedAt: string;
}

export function TimeClockKiosk() {
  const t = useTranslations('Workforce');
  const tCommon = useTranslations('Common');
  const [rawTokenInput, setRawTokenInput] = useState('');
  const [punches, setPunches] = useState<PunchItem[]>([]);

  // HR correction of a single punch.
  const [correcting, setCorrecting] = useState<PunchItem | null>(null);
  const [correctionType, setCorrectionType] = useState<'in' | 'out'>('in');
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionSaving, setCorrectionSaving] = useState(false);

  function openCorrection(p: PunchItem) {
    setCorrecting(p);
    setCorrectionType(p.punchType);
    // The column is timezone-naive, so the wall clock is what is edited.
    setCorrectionTime(String(p.scannedAt).slice(11, 16));
    setCorrectionReason('');
    setError(null);
  }

  async function saveCorrection() {
    if (!correcting || correctionReason.trim().length < 3) {
      return;
    }
    setCorrectionSaving(true);
    try {
      const day = String(correcting.scannedAt).slice(0, 10);
      const res = await fetch(`/api/workforce/punches/${correcting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType: correctionType,
          scannedAt: new Date(`${day}T${correctionTime}:00.000Z`).toISOString(),
          reason: correctionReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCorrecting(null);
        setLastPunch(null);
        fetchPunches();
      } else {
        setError(json.error?.message || t('punchCorrectFailed'));
      }
    } catch {
      setError(t('punchCorrectFailed'));
    } finally {
      setCorrectionSaving(false);
    }
  }
  const [submitting, setSubmitting] = useState(false);
  const [lastPunch, setLastPunch] = useState<{ name: string; type: 'in' | 'out' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPunches = async () => {
    try {
      const res = await fetch('/api/workforce/punches');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPunches(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPunches();
  }, []);

  const handlePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTokenInput.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/workforce/punches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: rawTokenInput.trim(),
          // punchType deliberately omitted: the server decides.
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setLastPunch({ name: json.data.employeeName || 'Employé', type: json.data.action });
        setRawTokenInput('');
        fetchPunches();
      } else {
        setError(json.error?.message || t('punchFailed'));
      }
    } catch {
      setError(t('punchConnError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12 text-start">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs text-center sm:text-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0 mx-auto sm:mx-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              {t('kioskTitle')}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('kioskSubtitle')}
            </p>
          </div>
        </div>

        <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs mx-auto sm:mx-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t('certifiedBadge')}</span>
        </Badge>
      </div>

      {/* No mode selector: the server derives arrival or departure from the
          employee's own last punch, so the kiosk cannot offer a contradictory
          action in the first place. A person does not "choose" to clock out. */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
        <p className="text-xs text-slate-500">{t('punchAutoHint')}</p>

        <form onSubmit={handlePunch} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('scanBadgeLabel')}</label>
            <Input
              type="password"
              required
              value={rawTokenInput}
              onChange={(e) => setRawTokenInput(e.target.value)}
              placeholder={t('scanBadgePlaceholder')}
              className="text-xs rounded-xl h-11 border-slate-200 focus:ring-2 focus:ring-[#2487B8] font-mono text-center text-sm"
              autoFocus
            />
          </div>

          {lastPunch && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                {lastPunch.type === 'in' ? t('punchSuccessIn', { name: lastPunch.name }) : t('punchSuccessOut', { name: lastPunch.name })}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className={`w-full h-11 font-bold text-xs rounded-xl shadow-2xs gap-2 ${
              'bg-[#2487B8] hover:bg-[#1B6C93] text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{submitting ? tCommon('loading') : t('punchSubmitAuto')}</span>
          </Button>
        </form>
      </Card>

      {/* Recent Punches Journal Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          {t('recentPunchesTitle')}
        </h3>

        <div className="space-y-2">
          {punches.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Badge variant={p.punchType === 'in' ? 'success' : 'warning'} className="text-[10px] font-bold uppercase">
                  {p.punchType === 'in' ? t('btnPunchIn') : t('btnPunchOut')}
                </Badge>
                <span className="font-extrabold text-[#16212B]">{p.employeeName || p.employeeId}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-slate-500">{new Date(p.scannedAt).toLocaleTimeString('fr-FR')}</span>
                {/* The kiosk can only ever write the legally-next action, so it
                    cannot fix a missed clock-out. Correcting that is an HR act
                    with a reason, kept off the one-task kiosk surface. */}
                <button
                  type="button"
                  onClick={() => openCorrection(p)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t('punchCorrect')}
                </button>
              </div>
            </div>
          ))}

          {punches.length === 0 && <p className="text-xs text-slate-400 text-center py-6">{t('noPunchesToday')}</p>}
        </div>
      </Card>

      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div role="dialog" aria-modal="true" aria-label={t('punchCorrectTitle')} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('punchCorrectTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {correcting.employeeName || correcting.employeeId} · {new Date(correcting.scannedAt).toLocaleString('fr-FR')}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700" htmlFor="correction-type">{t('punchTypeLabel')}</label>
                <select
                  id="correction-type"
                  value={correctionType}
                  onChange={e => setCorrectionType(e.target.value as 'in' | 'out')}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="in">{t('btnPunchIn')}</option>
                  <option value="out">{t('btnPunchOut')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700" htmlFor="correction-time">{t('punchCorrectTime')}</label>
                <input
                  id="correction-time"
                  type="time"
                  value={correctionTime}
                  onChange={e => setCorrectionTime(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2 text-xs"
                />
              </div>
            </div>

            <label className="mt-3 block text-xs font-bold text-slate-700" htmlFor="correction-reason">{t('punchCorrectReason')}</label>
            <textarea
              id="correction-reason"
              value={correctionReason}
              onChange={e => setCorrectionReason(e.target.value)}
              placeholder={t('punchCorrectReasonPlaceholder')}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrecting(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                disabled={correctionSaving || correctionReason.trim().length < 3}
                onClick={() => void saveCorrection()}
                className="rounded-xl bg-[#2487B8] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {correctionSaving ? tCommon('loading') : t('punchCorrectSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
