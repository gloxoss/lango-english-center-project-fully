'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, ShieldX, Key, Eye, EyeOff, Copy,
  CheckCircle2, AlertCircle, AlertTriangle, Lock,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TwoFaStatus = {
  enabled: boolean;
  enrolledAt: string | null;
};

type Step = 'idle' | 'qr' | 'codes' | 'disabling';

function BackupCodes({ codes }: { codes: string[] }) {
  const t = useTranslations('TwoFactor');
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>{t('codesOnce')}</strong> {t('codesHint')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {codes.map(code => (
          <code key={code} className="text-xs font-mono bg-slate-100 rounded-lg px-3 py-2 text-slate-700 text-center">
            {code}
          </code>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={copy} className="gap-2 text-xs rounded-xl w-full">
        <Copy className="w-3.5 h-3.5" />
        {copied ? t('copied') : t('copyAll')}
      </Button>
    </div>
  );
}

export default function TwoFactorPage() {
  const t = useTranslations('TwoFactor');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const [status, setStatus] = useState<TwoFaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('idle');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Load current 2FA status via Better Auth session
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/get-session');
      const json = await res.json();
      const user = json?.user;
      setStatus({
        enabled: Boolean(user?.twoFactorEnabled),
        enrolledAt: user?.twoFactorEnrolledAt ?? null,
      });
    } catch {
      showToast('err', t('statusError'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Step 1: Request QR code from Better Auth
  const startEnable = async () => {
    setWorking(true);
    try {
      const res = await fetch('/api/auth/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.totpURI) {
        setOtpauthUri(json.totpURI);
        // Backup codes are returned by /two-factor/enable, not by verify.
        setBackupCodes(json.backupCodes ?? []);
        setStep('qr');
        setPassword('');
      } else {
        showToast('err', json.message ?? t('enableError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setWorking(false);
    }
  };

  // Step 2: Verify the TOTP code with /two-factor/verify-totp. Success flips
  // twoFactorEnabled on the user row; the backup codes were already captured
  // at the enable step.
  const verifyOtp = async () => {
    if (otp.length !== 6) {
      showToast('err', t('enterSixDigits'));
      return;
    }
    setWorking(true);
    try {
      const res = await fetch('/api/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp }),
      });
      const json = await res.json();
      if (json.user || json.token) {
        setStep('codes');
        setOtp('');
      } else {
        showToast('err', json.message ?? t('invalidCode'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setWorking(false);
    }
  };

  // Finish enrollment
  const finishEnable = async () => {
    await loadStatus();
    setStep('idle');
    setBackupCodes([]);
    setSavedConfirmed(false);
    showToast('ok', t('enabled'));
  };

  // Disable 2FA
  const disable2fa = async () => {
    setWorking(true);
    try {
      const res = await fetch('/api/auth/two-factor/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.status || json.user) {
        await loadStatus();
        setStep('idle');
        setPassword('');
        showToast('ok', t('disabled'));
      } else {
        showToast('err', json.message ?? t('wrongPassword'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Status card */}
      <Card className="p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              status?.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
            }`}>
              {status?.enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldX className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                {status?.enabled ? t('statusOn') : t('statusOff')}
              </p>
              {status?.enrolledAt && (
                <p className="text-[10px] text-slate-500">
                  {t('since', { date: new Date(status.enrolledAt).toLocaleDateString(intlLocale) })}
                </p>
              )}
            </div>
          </div>
          <Badge variant={status?.enabled ? 'success' : 'neutral'}>
            {status?.enabled ? '2FA ON' : '2FA OFF'}
          </Badge>
        </div>

        {/* Actions based on step */}
        {step === 'idle' && (
          <>
            {!status?.enabled ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  {t('enterPassword')}
                </p>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    aria-label={t('passwordPlaceholder')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && startEnable()}
                    className="h-9 text-xs pr-10 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? t('hidePassword') : t('showPassword')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={startEnable}
                  disabled={working || !password}
                  className="w-full gap-2 h-9 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Key className="w-4 h-4" />
                  {working ? t('loading') : t('setUp')}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setStep('disabling')}
                className="gap-2 text-xs rounded-xl w-full h-9 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Lock className="w-3.5 h-3.5" />
                {t('turnOff')}
              </Button>
            )}
          </>
        )}

        {step === 'qr' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 rounded-xl flex flex-col items-center gap-2">
              <QRCodeSVG value={otpauthUri} size={180} marginSize={2} />
              <p className="text-xs text-slate-500 text-center">
                {t('scanHint')}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                {t('codeLabel')}
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={t('codeLabel')}
                className="h-9 text-sm font-mono text-center rounded-xl tracking-widest"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('idle')} className="flex-1 text-xs rounded-xl h-9">
                {t('cancel')}
              </Button>
              <Button
                onClick={verifyOtp}
                disabled={working || otp.length !== 6}
                className="flex-1 text-xs rounded-xl h-9 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {working ? t('verifying') : t('verify')}
              </Button>
            </div>
          </div>
        )}

        {step === 'codes' && (
          <div className="space-y-4">
            {backupCodes.length > 0
              ? <BackupCodes codes={backupCodes} />
              : <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">{t('noBackupCodes')}</p>}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={savedConfirmed}
                onChange={e => setSavedConfirmed(e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
              {t('savedConfirm')}
            </label>
            <Button
              onClick={finishEnable}
              disabled={!savedConfirmed}
              className="w-full text-xs rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('finish')}
            </Button>
          </div>
        )}

        {step === 'disabling' && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('disableWarning')}</span>
            </div>
            <Input
              type="password"
              placeholder={t('passwordPlaceholder')}
              aria-label={t('passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('idle')} className="flex-1 text-xs rounded-xl h-9">
                {t('cancel')}
              </Button>
              <Button
                onClick={disable2fa}
                disabled={working || !password}
                className="flex-1 text-xs rounded-xl h-9 bg-red-500 hover:bg-red-600 text-white"
              >
                {working ? t('disabling') : t('confirmDisable')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Info */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">{t('recommendedApps')}</p>
        <p>Google Authenticator · Authy · Microsoft Authenticator · 1Password</p>
      </div>
    </div>
  );
}
