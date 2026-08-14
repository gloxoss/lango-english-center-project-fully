'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle, CheckCircle2, Copy, Eye, EyeOff, GraduationCap, Key, Lock, ShieldCheck,
} from 'lucide-react';
import { authClient } from '@/libs/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Step = 'password' | 'qr' | 'codes';

// Rendered by the dashboard shell when 2FA is mandatory for this account but
// not yet enrolled (see src/app/[locale]/(dashboard)/layout.tsx). Self-contained
// so it does not depend on the sidebar/header hydration that the shell needs.
export function TwoFactorRequired({ locale, email }: { locale: string; email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [totpUri, setTotpUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const res = await authClient.twoFactor.enable({ password });
      if (res.error) {
        setError(res.error.message || "Mot de passe incorrect.");
        return;
      }
      setTotpUri(res.data?.totpURI ?? '');
      setBackupCodes(res.data?.backupCodes ?? []);
      setPassword('');
      setStep('qr');
    } catch {
      setError('Erreur réseau.');
    } finally {
      setWorking(false);
    }
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Entrez le code à 6 chiffres de votre application.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: otp, trustDevice: true });
      if (res.error) {
        setError(res.error.message || 'Code invalide. Réessayez.');
        return;
      }
      setOtp('');
      setStep('codes');
    } catch {
      setError('Erreur réseau.');
    } finally {
      setWorking(false);
    }
  };

  const finish = () => {
    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-[#0066FF] rounded-2xl flex items-center justify-center shadow-md shadow-[#0066FF]/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Sécurisez votre compte
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Votre rôle exige l&apos;authentification à deux facteurs. Activez-la maintenant
            pour continuer. <span className="font-semibold text-slate-600">{email}</span>
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          {step === 'password' && (
            <form onSubmit={startEnable} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Votre mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-10 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={working || !password}
                className="w-full h-11 gap-2 rounded-xl text-xs font-semibold bg-[#0066FF] hover:bg-[#0052CC] text-white"
              >
                <Key className="w-4 h-4" />
                {working ? 'Chargement...' : 'Générer le code QR'}
              </Button>
            </form>
          )}

          {step === 'qr' && (
            <>
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    {totpUri ? (
                      <QRCodeSVG value={totpUri} size={176} marginSize={2} />
                    ) : (
                      <div className="w-44 h-44 bg-slate-100 rounded-xl" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Scannez ce code avec votre application d&apos;authentification
                  (Google Authenticator, Authy, Microsoft Authenticator).
                </p>
              </div>
              <form onSubmit={verifyTotp} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Code de vérification (6 chiffres)
                  </label>
                  <Input
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="h-11 text-sm font-mono text-center rounded-xl tracking-widest"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={working || otp.length !== 6}
                  className="w-full h-11 gap-2 rounded-xl text-xs font-semibold bg-[#0066FF] hover:bg-[#0052CC] text-white"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {working ? 'Vérification...' : 'Vérifier et activer'}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="w-full text-xs font-bold text-slate-500 hover:text-[#0066FF] transition-colors"
                >
                  Retour
                </button>
              </form>
            </>
          )}

          {step === 'codes' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Authentification à deux facteurs activée.
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Conservez ces codes de secours.</strong> Chaque code ne peut être
                  utilisé qu&apos;une seule fois pour vous connecter si vous perdez votre téléphone.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map(code => (
                  <code key={code} className="text-xs font-mono bg-slate-100 rounded-lg px-3 py-2 text-slate-700 text-center">
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0066FF] transition-colors py-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Copier tous les codes
              </button>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={e => setSavedConfirmed(e.target.checked)}
                  className="w-4 h-4 accent-[#0066FF] rounded"
                />
                J&apos;ai copié et conservé mes codes de secours en lieu sûr.
              </label>
              <Button
                onClick={finish}
                disabled={!savedConfirmed}
                className="w-full h-11 gap-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Accéder au tableau de bord
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
