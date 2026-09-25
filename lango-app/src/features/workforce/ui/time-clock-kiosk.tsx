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
              <span className="font-mono text-slate-500">{new Date(p.scannedAt).toLocaleTimeString('fr-FR')}</span>
            </div>
          ))}

          {punches.length === 0 && <p className="text-xs text-slate-400 text-center py-6">{t('noPunchesToday')}</p>}
        </div>
      </Card>
    </div>
  );
}
