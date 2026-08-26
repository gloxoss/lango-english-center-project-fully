'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { authClient } from '@/libs/auth-client';

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Administrateur Établissement',
  teacher: 'Enseignant / Professeur',
  accountant: 'Comptable & Gestionnaire Financier',
  receptionist: 'Réceptionniste & Accueil',
  librarian: 'Bibliothécaire',
  guard: 'Agent de Sécurité & Gardien',
  student: 'Élève',
  parent: 'Parent / Tuteur',
};

type Props = {
  locale: string;
  token: string;
};

type InvitationData = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  schoolName: string;
  schoolLogo: string | null;
};

export function AcceptInviteClient({ locale, token }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/invitations/${token}`);
        const json = await res.json();

        if (!res.ok || !json.success || !json.valid) {
          setFetchError(
            json.error?.message ||
            (json.data?.isExpired
              ? 'Cette invitation a expiré. Veuillez demander une nouvelle invitation à votre administrateur.'
              : 'Ce lien d\'invitation est invalide ou a déjà été utilisé.')
          );
        } else {
          setInvitation(json.data);
        }
      } catch {
        setFetchError('Impossible de vérifier l\'invitation. Veuillez vérifier votre connexion.');
      } finally {
        setLoading(false);
      }
    }

    void loadInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/public/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error?.message || data.message || 'Erreur lors de l\'activation du compte.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);

      // Auto sign-in
      if (invitation?.email) {
        const signInRes = await authClient.signIn.email({
          email: invitation.email,
          password,
        });

        if (!signInRes.error) {
          router.push(`/${locale}/dashboard`);
          router.refresh();
          return;
        }
      }

      // Fallback redirect to login
      setTimeout(() => {
        router.push(`/${locale}/login?activated=1`);
      }, 1500);
    } catch {
      setSubmitError('Erreur de connexion. Veuillez réessayer.');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex bg-[#F8F9FA] font-sans antialiased text-[#191C1D]">
      {/* ─── LEFT PANEL ─── */}
      <section className="hidden lg:flex lg:w-[50%] bg-[#F9FAFB] p-16 flex-col justify-between relative overflow-hidden border-r border-slate-200/80">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="absolute -top-24 -right-24 w-[450px] h-[450px] bg-gradient-to-br from-[#0066FF]/10 via-[#2487B8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

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
                Portail Collaborateur
              </span>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4EDFD] border border-[#C3DAFB] text-xs font-bold text-[#2487B8]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Invitation Officielle</span>
            </div>

            <h1 className="text-4xl font-extrabold text-[#16212B] leading-tight tracking-tight">
              Rejoignez l&apos;équipe de votre établissement.
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              Activez votre compte professionnel pour accéder à vos classes, cahiers de texte,
              gestion des présences et outils pédagogiques.
            </p>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#16212B]">
                <Shield className="w-4 h-4 text-[#0066FF]" />
                <span>Accès Sécurisé & Authentifié</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Vos identifiants sont strictement confidentiels et protégés conformément aux normes de sécurité CNDP.
              </p>
            </div>
          </div>
        </div>

        <div className="z-10">
          <p className="text-[11px] text-slate-400 font-medium">
            © 2026 SchoolOS — Système d&apos;Exploitation Éducatif au Maroc.
          </p>
        </div>
      </section>

      {/* ─── RIGHT PANEL ─── */}
      <section className="w-full lg:w-[50%] bg-white flex flex-col justify-center items-center p-8 md:p-12 lg:p-16 relative overflow-y-auto">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066FF] rounded-xl flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black text-[#16212B]">SchoolOS</span>
              <span className="block text-[10px] font-bold text-[#2487B8] uppercase">
                Portail Collaborateur
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#0066FF]" />
              <p className="text-xs font-bold text-slate-600">Vérification de l&apos;invitation en cours...</p>
            </div>
          ) : fetchError ? (
            <div className="space-y-6">
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <h3 className="text-sm font-extrabold text-rose-900">Lien d&apos;invitation invalide</h3>
                <p className="text-xs text-rose-700 leading-relaxed">{fetchError}</p>
              </div>

              <div className="text-center">
                <Link
                  href={`/${locale}/login`}
                  className="inline-flex items-center justify-center h-10 px-6 bg-[#16212B] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Aller à la page de connexion
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#16212B]">Compte activé !</h2>
              <p className="text-xs text-slate-600">
                Votre compte a été créé avec succès. Redirection vers votre tableau de bord...
              </p>
              <Loader2 className="w-5 h-5 animate-spin text-[#0066FF] mx-auto" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[#16212B] tracking-tight mb-1">
                  Rejoindre l&apos;établissement
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Complétez votre profil pour activer votre accès.
                </p>
              </div>

              {/* School & Role Badge */}
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-[#16212B] block">
                      {invitation?.schoolName || 'Établissement Scolaire'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Rôle assigné :{' '}
                      <span className="font-bold text-[#0066FF]">
                        {ROLE_LABELS[invitation?.role || ''] || invitation?.role}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200/60">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{invitation?.email}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Nom et Prénom *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Fatima Zahra Alami"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-700">
                    Confirmer le mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Répétez votre mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-[#0066FF] focus:bg-white rounded-xl text-xs font-medium text-[#16212B] outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#0066FF]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activation du compte...</span>
                    </>
                  ) : (
                    <>
                      <span>Activer mon compte</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium">
                  Vous avez déjà un mot de passe ?{' '}
                  <Link
                    href={`/${locale}/login`}
                    className="font-extrabold text-[#0066FF] hover:text-[#0052CC] transition-colors underline underline-offset-4"
                  >
                    Se connecter
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
