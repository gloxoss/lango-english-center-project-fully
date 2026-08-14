'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { authClient } from '@/libs/auth-client';

export function LoginClient({ tenantSlug, tenantData }: { tenantSlug?: string, tenantData?: { name: string, logoUrl: string | null } }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] ?? 'fr';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  // Set when the server answers sign-in with `twoFactorRedirect` instead of a
  // session: password was right, a TOTP/backup code is still required.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  // Two-factor providers available for this user (`twoFactorMethods` from the
  // sign-in response): 'totp' when they have a secret, 'otp' when the email
  // sendOTP sink is configured.
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);
  const [emailOtpRequested, setEmailOtpRequested] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || 'Identifiants incorrects. Veuillez réessayer.');
      } else if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        const d = res.data as { twoFactorMethods?: string[] } | null;
        setNeedsTwoFactor(true);
        setTwoFactorMethods(d?.twoFactorMethods ?? []);
        setEmailOtpRequested(false);
        setEmailOtpSent(false);
      } else {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  // A 6-digit value is a TOTP code; anything else is treated as a backup code.
  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const code = totpCode.trim();
    const isDigits = /^\d{6}$/.test(code);
    try {
      // When the user asked for an email code, a 6-digit input is an OTP (not a
      // TOTP). Otherwise route TOTP vs backup code by shape.
      const res = emailOtpRequested && isDigits
        ? await authClient.twoFactor.verifyOtp({ code, trustDevice: rememberMe })
        : isDigits
          ? await authClient.twoFactor.verifyTotp({ code, trustDevice: rememberMe })
          : await authClient.twoFactor.verifyBackupCode({ code, trustDevice: rememberMe });

      if (res.error) {
        setError(res.error.message || 'Code invalide. Veuillez réessayer.');
      } else {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Vérification impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  // Send a 2FA code by email (log-only delivery; the code is recorded in the
  // two_factor_otps table). Shown when the server reports the 'otp' method.
  const handleSendEmailOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.twoFactor.sendOtp();
      if (res.error) {
        setError(res.error.message || 'Envoi du code impossible.');
      } else {
        setEmailOtpRequested(true);
        setEmailOtpSent(true);
      }
    } catch {
      setError('Envoi du code impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  const handleForgotPassword = () => {
    if (!email) {
      setError('Veuillez saisir votre adresse e-mail ci-dessus puis cliquer à nouveau.');
      return;
    }
    setForgotSent(true);
    setError(null);
    setTimeout(() => setForgotSent(false), 5000);
  };

  return (
    <main className="min-h-screen flex bg-[#F8F9FA] font-sans antialiased text-[#191C1D]">
      {/* ─── LEFT PANEL (55% Width on Desktop) ─── */}
      <section className="hidden lg:flex lg:w-[55%] bg-[#F9FAFB] p-16 flex-col justify-between relative overflow-hidden border-r border-slate-200/80">
        {/* Subtle Radial Dot Pattern */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient Gradient Glows */}
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-gradient-to-br from-[#0066FF]/10 via-[#2487B8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[450px] h-[450px] bg-gradient-to-tr from-emerald-500/10 via-[#0066FF]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Header */}
        <div className="z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 bg-[#0066FF] rounded-2xl flex items-center justify-center shadow-md shadow-[#0066FF]/20 overflow-hidden">
              {tenantData?.logoUrl ? (
                <img src={tenantData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#16212B]">
                {tenantData?.name || 'SchoolOS'}
              </span>
              <span className="block text-[10px] font-bold text-[#2487B8] uppercase tracking-widest">
                {tenantData ? 'Espace Établissement' : 'Plateforme Scolaire Maroc'}
              </span>
            </div>
          </div>

          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4EDFD] border border-[#C3DAFB] text-xs font-bold text-[#2487B8]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Système de Gestion d&apos;Établissement Nouvelle Génération</span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-extrabold text-[#16212B] leading-[1.1] tracking-tight">
              Pilotez votre école, <br />
              <span className="text-[#0066FF]">en toute simplicité.</span>
            </h1>

            <p className="text-base text-slate-600 max-w-lg leading-relaxed">
              La plateforme complète dédiée aux centres de langues et établissements scolaires au Maroc.
              Gestion des élèves, présences, finances et conformité CNDP F211.
            </p>
          </div>
        </div>

        {/* Bottom Social Proof & Compliance Bar */}
        <div className="z-10 space-y-4">
          <div className="inline-flex items-center gap-4 bg-white/80 backdrop-blur-md border border-slate-200/90 px-6 py-4 rounded-2xl shadow-xs">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-extrabold ring-2 ring-white">
                YA
              </div>
              <div className="w-10 h-10 rounded-full bg-[#2487B8] text-white flex items-center justify-center text-xs font-extrabold ring-2 ring-white">
                LB
              </div>
              <div className="w-10 h-10 rounded-full bg-[#17A673] text-white flex items-center justify-center text-xs font-extrabold ring-2 ring-white">
                OE
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#16212B]">
                +500 Établissements & Centres Scolaires
              </p>
              <p className="text-[10px] font-bold text-[#2487B8] uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Conforme CNDP F211 Maroc
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            © 2026 Lango English Center & SchoolOS Administration Portal. Tous droits réservés.
          </p>
        </div>
      </section>

      {/* ─── RIGHT PANEL (45% Width on Desktop) ─── */}
      <section className="w-full lg:w-[45%] bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-20 relative">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile Logo Branding */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066FF] rounded-xl flex items-center justify-center text-white overflow-hidden">
              {tenantData?.logoUrl ? (
                <img src={tenantData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-lg font-black text-[#16212B]">{tenantData?.name || 'SchoolOS'}</span>
              <span className="block text-[10px] font-bold text-[#2487B8] uppercase">
                {tenantData ? 'Espace Établissement' : 'Plateforme Éducative'}
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-3xl font-extrabold text-[#16212B] tracking-tight mb-2">
              Connexion
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Saisissez vos identifiants pour accéder à votre espace d&apos;administration.
            </p>
          </div>

          {/* Success Notification */}
          {forgotSent && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
              Si cette adresse e-mail existe, un lien de réinitialisation vous a été envoyé.
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Two-Factor Challenge */}
          {needsTwoFactor
            ? (
                <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Code de vérification
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        placeholder="123456"
                        value={totpCode}
                        onChange={e => setTotpCode(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] placeholder:text-slate-400 outline-none transition-all tracking-[0.3em]"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Saisissez le code à 6 chiffres de votre application d&apos;authentification, ou l&apos;un de vos codes de secours.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#0066FF]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {loading
                      ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Vérification...</span>
                          </>
                        )
                      : (
                          <>
                            <span>Vérifier</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                  </button>

                  {emailOtpSent && (
                    <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold">
                      Un code à 6 chiffres a été envoyé à votre adresse e-mail. Saisissez-le ci-dessus.
                    </p>
                  )}

                  {twoFactorMethods.includes('otp') && !emailOtpRequested && (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={loading}
                      className="w-full text-xs font-bold text-[#0066FF] hover:text-[#0052CC] transition-colors"
                    >
                      {loading ? 'Envoi...' : 'Recevoir un code par e-mail'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setNeedsTwoFactor(false);
                      setTotpCode('');
                      setEmailOtpRequested(false);
                      setEmailOtpSent(false);
                      setError(null);
                    }}
                    className="w-full text-xs font-bold text-slate-500 hover:text-[#0066FF] transition-colors"
                  >
                    Retour à la connexion
                  </button>
                </form>
              )
            : (
                <>
                  {/* Main Login Form */}
                  <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="directeur@atlas.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] placeholder:text-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-[#0066FF] hover:text-[#0052CC] transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-11 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] placeholder:text-slate-400 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
              />
              <label htmlFor="remember" className="text-xs font-semibold text-slate-600 cursor-pointer">
                Se souvenir de moi sur cet appareil
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#0066FF]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#0066FF]" />
              <span>Comptes de Démo (Clic rapide)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('y.elamrani@atlas.ma', 'Admin123!')}
                className="px-2 py-1.5 bg-white border border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] rounded-lg text-[10px] font-bold text-slate-700 transition-colors text-center truncate"
              >
                Directeur
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('admin@lango.ma', 'Admin123!')}
                className="px-2 py-1.5 bg-white border border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] rounded-lg text-[10px] font-bold text-slate-700 transition-colors text-center truncate"
              >
                Admin Lango
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('fz.idrissi@atlas.ma', 'Admin123!')}
                className="px-2 py-1.5 bg-white border border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] rounded-lg text-[10px] font-bold text-slate-700 transition-colors text-center truncate"
              >
                Enseignante
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('superadmin@schoolos.ma', 'Admin123!')}
                className="px-2 py-1.5 bg-white border border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] rounded-lg text-[10px] font-bold text-slate-700 transition-colors text-center truncate"
              >
                Super Admin
              </button>
            </div>
                  </div>
                </>
              )}

          {/* Toggle to Signup */}
          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Nouveau centre de langues ou établissement ?{' '}
              <Link
                href={`/${locale}/signup`}
                className="font-extrabold text-[#0066FF] hover:text-[#0052CC] transition-colors underline underline-offset-4"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
