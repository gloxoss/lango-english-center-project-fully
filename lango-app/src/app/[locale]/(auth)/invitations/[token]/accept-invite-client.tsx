'use client';

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
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { authClient } from '@/libs/auth-client';

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
  const t = useTranslations('AcceptInvitation');
  const tRoles = useTranslations('Roles');

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
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch(`/api/public/invitations/${encodeURIComponent(token)}`);
        const json = await res.json();

        if (!res.ok || !json.success || !json.valid) {
          setFetchError(json.data?.isExpired
            ? t('expired')
            : json.error?.code === 'INVALID_TOKEN' || (res.ok && !json.valid)
              ? t('invalid')
              : t('verifyError'));
        } else {
          setInvitation(json.data);
        }
      } catch {
        setFetchError(t('verifyError'));
      } finally {
        setLoading(false);
      }
    }

    void loadInvitation();
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (fullName.trim().length < 2) {
      setSubmitError(t('nameTooShort'));
      return;
    }

    if (password.length < 8) {
      setSubmitError(t('passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError(t('passwordMismatch'));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/public/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const code = data.error?.code;
        setSubmitError(code === 'INVITATION_EXPIRED'
          ? t('expired')
          : code === 'USER_EXISTS'
            ? t('accountExists')
            : code === 'INVITATION_NOT_PENDING' || code === 'INVALID_TOKEN'
              ? t('invalid')
              : t('activationError'));
        setSubmitting(false);
        return;
      }

      setSuccess(true);

      try {
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
      } catch {
        // Activation succeeded; a sign-in problem should lead to login.
      }

      setRedirectingToLogin(true);
      setTimeout(() => {
        router.push(`/${locale}/login?activated=1`);
      }, 1500);
    } catch {
      setSubmitError(t('networkError'));
      setSubmitting(false);
    }
  };

  return (
    <main className="
      flex min-h-screen bg-[#F8F9FA] font-sans text-[#191C1D] antialiased
    "
    >
      {/* ─── LEFT PANEL ─── */}
      <section className="
        relative hidden flex-col justify-between overflow-hidden border-r
        border-slate-200/80 bg-[#F9FAFB] p-16
        lg:flex lg:w-[50%]
      "
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="
          pointer-events-none absolute -top-24 -right-24 size-[450px]
          rounded-full bg-linear-to-br from-[#0066FF]/10 via-[#2487B8]/10
          to-transparent blur-3xl
        "
        />

        <div className="z-10">
          <div className="mb-12 flex items-center gap-3">
            <div className="
              flex size-11 items-center justify-center rounded-2xl bg-[#0066FF]
              shadow-md shadow-[#0066FF]/20
            "
            >
              <GraduationCap className="size-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#16212B]">
                SchoolOS
              </span>
              <span className="
                block text-[10px] font-bold tracking-widest text-[#2487B8]
                uppercase
              "
              >
                {t('portalLabel')}
              </span>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <div className="
              inline-flex items-center gap-2 rounded-full border
              border-[#C3DAFB] bg-[#E4EDFD] px-3 py-1 text-xs font-bold
              text-[#2487B8]
            "
            >
              <Sparkles className="size-3.5" />
              <span>{t('invitationBadge')}</span>
            </div>

            <h1 className="
              text-4xl/tight font-extrabold tracking-tight text-[#16212B]
            "
            >
              {t('heroTitle')}
            </h1>

            <p className="text-sm/relaxed text-slate-600">
              {t('heroDescription')}
            </p>

            <div className="
              space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4
              shadow-xs
            "
            >
              <div className="
                flex items-center gap-2 text-xs font-bold text-[#16212B]
              "
              >
                <Shield className="size-4 text-[#0066FF]" />
                <span>{t('securityTitle')}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {t('securityDescription')}
              </p>
            </div>
          </div>
        </div>

        <div className="z-10">
          <p className="text-[11px] font-medium text-slate-400">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </section>

      {/* ─── RIGHT PANEL ─── */}
      <section className="
        relative flex w-full flex-col items-center justify-center
        overflow-y-auto bg-white p-8
        md:p-12
        lg:w-[50%] lg:p-16
      "
      >
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Logo */}
          <div className="
            flex items-center gap-3
            lg:hidden
          "
          >
            <div className="
              flex size-10 items-center justify-center rounded-xl bg-[#0066FF]
              text-white
            "
            >
              <GraduationCap className="size-5" />
            </div>
            <div>
              <span className="text-lg font-black text-[#16212B]">SchoolOS</span>
              <span className="
                block text-[10px] font-bold text-[#2487B8] uppercase
              "
              >
                {t('portalLabel')}
              </span>
            </div>
          </div>

          {loading
            ? (
                <div className="
                  flex flex-col items-center justify-center space-y-3 py-16
                  text-center
                "
                >
                  <Loader2 className="size-8 animate-spin text-[#0066FF]" />
                  <p className="text-xs font-bold text-slate-600">{t('verifying')}</p>
                </div>
              )
            : fetchError
              ? (
                  <div className="space-y-6">
                    <div className="
                      space-y-3 rounded-2xl border border-rose-200 bg-rose-50
                      p-5 text-center
                    "
                    >
                      <AlertCircle className="mx-auto size-8 text-rose-600" />
                      <h3 className="text-sm font-extrabold text-rose-900">{t('invalidTitle')}</h3>
                      <p className="text-xs/relaxed text-rose-700">{fetchError}</p>
                    </div>

                    <div className="text-center">
                      <Link
                        href={`/${locale}/login`}
                        className="
                          inline-flex h-10 items-center justify-center
                          rounded-xl bg-[#16212B] px-6 text-xs font-bold
                          text-white transition-all
                          hover:bg-slate-800
                        "
                      >
                        {t('goToLogin')}
                      </Link>
                    </div>
                  </div>
                )
              : success
                ? (
                    <div className="space-y-4 py-8 text-center">
                      <div className="
                        mx-auto flex size-12 items-center justify-center
                        rounded-full bg-emerald-100 text-emerald-600
                      "
                      >
                        <CheckCircle2 className="size-7" />
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#16212B]">{t('activatedTitle')}</h2>
                      <p className="text-xs text-slate-600">
                        {redirectingToLogin ? t('activatedRedirectLogin') : t('activatedRedirectDashboard')}
                      </p>
                      <Loader2 className="
                        mx-auto size-5 animate-spin text-[#0066FF]
                      "
                      />
                    </div>
                  )
                : (
                    <div className="space-y-6">
                      <div>
                        <h2 className="
                          mb-1 text-2xl font-extrabold tracking-tight
                          text-[#16212B]
                        "
                        >
                          {t('joinTitle')}
                        </h2>
                        <p className="text-xs font-medium text-slate-500">
                          {t('joinSubtitle')}
                        </p>
                      </div>

                      {/* School & Role Badge */}
                      <div className="
                        space-y-2.5 rounded-2xl border border-slate-200/90
                        bg-slate-50 p-4
                      "
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="
                            flex size-8 items-center justify-center rounded-lg
                            bg-[#0066FF]/10 font-bold text-[#0066FF]
                          "
                          >
                            <Building2 className="size-4" />
                          </div>
                          <div>
                            <span className="
                              block text-xs font-extrabold text-[#16212B]
                            "
                            >
                              {invitation?.schoolName || t('schoolFallback')}
                            </span>
                            <span className="
                              text-[10px] font-medium text-slate-500
                            "
                            >
                              {t('assignedRole')}
                              {' '}
                              <span className="font-bold text-[#0066FF]">
                                {invitation?.role && tRoles.has(invitation.role) ? tRoles(invitation.role as 'teacher') : invitation?.role}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="
                          flex items-center gap-2 rounded-xl border
                          border-slate-200/60 bg-white px-3 py-1.5 text-[11px]
                          font-semibold text-slate-600
                        "
                        >
                          <Mail className="size-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{invitation?.email}</span>
                        </div>
                      </div>

                      {submitError && (
                        <div
                          role="alert"
                          className="
                            flex items-start gap-2.5 rounded-xl border
                            border-rose-200 bg-rose-50 p-3.5 text-xs
                            font-semibold text-rose-700
                          "
                        >
                          <AlertCircle className="mt-0.5 size-4 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                          <label
                            htmlFor="invite-name"
                            className="
                              block text-[11px] font-extrabold text-slate-700
                            "
                          >
                            {t('fullName')}
                            {' '}
                            *
                          </label>
                          <div className="relative">
                            <User className="
                              absolute top-3 left-3 size-3.5 text-slate-400
                            "
                            />
                            <input
                              type="text"
                              id="invite-name"
                              required
                              placeholder={t('namePlaceholder')}
                              value={fullName}
                              onChange={e => setFullName(e.target.value)}
                              className="
                                h-10 w-full rounded-xl border border-slate-200
                                bg-slate-50 pr-3 pl-9 text-xs font-medium
                                text-[#16212B] transition-all outline-none
                                focus:border-[#0066FF] focus:bg-white
                              "
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="invite-password"
                            className="
                              block text-[11px] font-extrabold text-slate-700
                            "
                          >
                            {t('password')}
                            {' '}
                            *
                          </label>
                          <div className="relative">
                            <Lock className="
                              absolute top-3 left-3 size-3.5 text-slate-400
                            "
                            />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              id="invite-password"
                              required
                              placeholder={t('passwordPlaceholder')}
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                              className="
                                h-10 w-full rounded-xl border border-slate-200
                                bg-slate-50 pr-10 pl-9 text-xs font-medium
                                text-[#16212B] transition-all outline-none
                                focus:border-[#0066FF] focus:bg-white
                              "
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                              className="
                                absolute top-3 right-3 cursor-pointer
                                text-slate-400 transition-colors
                                hover:text-slate-600
                              "
                            >
                              {showPassword
                                ? (
                                    <EyeOff className="size-3.5" />
                                  )
                                : (
                                    <Eye className="size-3.5" />
                                  )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="invite-confirm-password"
                            className="
                              block text-[11px] font-extrabold text-slate-700
                            "
                          >
                            {t('confirmPassword')}
                            {' '}
                            *
                          </label>
                          <div className="relative">
                            <Lock className="
                              absolute top-3 left-3 size-3.5 text-slate-400
                            "
                            />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              id="invite-confirm-password"
                              required
                              placeholder={t('confirmPlaceholder')}
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              className="
                                h-10 w-full rounded-xl border border-slate-200
                                bg-slate-50 pr-3 pl-9 text-xs font-medium
                                text-[#16212B] transition-all outline-none
                                focus:border-[#0066FF] focus:bg-white
                              "
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="
                            mt-3 flex h-11 w-full cursor-pointer items-center
                            justify-center gap-2 rounded-xl bg-[#0066FF] text-xs
                            font-bold text-white shadow-md shadow-[#0066FF]/20
                            transition-all
                            hover:bg-[#0052CC]
                            disabled:opacity-70
                          "
                        >
                          {submitting
                            ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  <span>{t('activating')}</span>
                                </>
                              )
                            : (
                                <>
                                  <span>{t('activate')}</span>
                                  <ArrowRight className="size-4" />
                                </>
                              )}
                        </button>
                      </form>

                      <div className="
                        border-t border-slate-100 pt-2 text-center
                      "
                      >
                        <p className="text-xs font-medium text-slate-500">
                          {t('alreadyHavePassword')}
                          {' '}
                          <Link
                            href={`/${locale}/login`}
                            className="
                              font-extrabold text-[#0066FF] underline
                              underline-offset-4 transition-colors
                              hover:text-[#0052CC]
                            "
                          >
                            {t('signIn')}
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
