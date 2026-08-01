'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { authClient } from '@/libs/auth-client';

export default function SignupPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] ?? 'fr';

  const [formData, setFormData] = useState({
    schoolName: '',
    city: 'Casablanca',
    name: '',
    email: '',
    phone: '',
    password: '',
    acceptTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.acceptTerms) {
      setError('Veuillez accepter les conditions d\'utilisation et le traitement CNDP.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authClient.signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      if (res.error) {
        setError(res.error.message || 'Erreur lors de l\'inscription. Veuillez réessayer.');
      } else {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Inscription impossible. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
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
            <div className="w-11 h-11 bg-[#0066FF] rounded-2xl flex items-center justify-center shadow-md shadow-[#0066FF]/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#16212B]">
                SchoolOS
              </span>
              <span className="block text-[10px] font-bold text-[#2487B8] uppercase tracking-widest">
                Plateforme Scolaire Maroc
              </span>
            </div>
          </div>

          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4EDFD] border border-[#C3DAFB] text-xs font-bold text-[#2487B8]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Création d&apos;Établissement Instantanée</span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-extrabold text-[#16212B] leading-[1.1] tracking-tight">
              Inscrivez votre école <br />
              <span className="text-[#0066FF]">en 2 minutes.</span>
            </h1>

            <p className="text-base text-slate-600 max-w-lg leading-relaxed">
              Rejoignez le réseau d&apos;écoles et centres de langues qui modernisent leur gestion
              scolaire avec SchoolOS au Maroc. Essai gratuit 14 jours, sans engagement.
            </p>

            {/* Feature Checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Gestion multi-succursales & campus physiques</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Suivi automatisé des présences & retards</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Facturation, recus & paiements en DH</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Rapports CNDP F211 pré-remplis pour la CNDP</span>
              </div>
            </div>
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
                Rejoignez +500 Établissements
              </p>
              <p className="text-[10px] font-bold text-[#2487B8] uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Activation Immédiate
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            © 2026 Lango English Center & SchoolOS Administration Portal.
          </p>
        </div>
      </section>

      {/* ─── RIGHT PANEL (45% Width on Desktop) ─── */}
      <section className="w-full lg:w-[45%] bg-white flex flex-col justify-center items-center p-8 md:p-12 lg:p-16 relative overflow-y-auto">
        <div className="w-full max-w-[440px] space-y-6">
          {/* Mobile Logo Branding */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066FF] rounded-xl flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black text-[#16212B]">SchoolOS</span>
              <span className="block text-[10px] font-bold text-[#2487B8] uppercase">
                Plateforme Éducative
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-3xl font-extrabold text-[#16212B] tracking-tight mb-1.5">
              Créer votre établissement
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Configurez votre école et votre compte administrateur principal.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Establishment Info */}
            <div className="space-y-3 pt-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#2487B8]">
                1. Information Établissement
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Nom Établissement *
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Groupe Atlas"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Ville *
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Casablanca"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Administrator Info */}
            <div className="space-y-3 pt-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#2487B8]">
                2. Compte Administrateur Principal
              </p>

              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-slate-700">
                  Nom et Prénom *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Youssef El Amrani"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Email Professionnel *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="nom@ecole.ma"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+212 6..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-slate-700">
                  Mot de passe *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Au moins 8 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                required
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF] mt-0.5"
              />
              <label htmlFor="terms" className="text-[11px] font-semibold text-slate-600 leading-tight cursor-pointer">
                J&apos;accepte les conditions d&apos;utilisation et le traitement des données conformément à la loi 09-08 (CNDP).
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#0066FF]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Création de votre espace...</span>
                </>
              ) : (
                <>
                  <span>Créer mon compte établissement</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle to Login */}
          <div className="pt-3 text-center border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Vous avez déjà un compte ?{' '}
              <Link
                href={`/${locale}/login`}
                className="font-extrabold text-[#0066FF] hover:text-[#0052CC] transition-colors underline underline-offset-4"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
