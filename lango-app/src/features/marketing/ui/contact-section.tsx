'use client';

import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { useLocale } from '../context/locale-context';
import { CONTACT_CONTENT_I18N } from '../data/marketing-content';

const fieldStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
};

const fieldClassName = `
  h-12 w-full rounded-xl px-4 text-sm font-normal transition-all outline-none
  placeholder:text-white/40 focus:border-[#2487B8] focus:bg-white/15
`;

type FieldProps = {
  autoComplete?: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
};

const WaitlistField = ({
  autoComplete,
  id,
  label,
  name,
  placeholder,
  required = true,
  type = 'text',
}: FieldProps) => (
  <div className="flex w-full flex-col gap-2 text-start">
    <label htmlFor={id} className="text-sm font-medium text-white/90">
      {label}
    </label>
    <input
      id={id}
      name={name}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      required={required}
      style={fieldStyle}
      className={fieldClassName}
    />
  </div>
);

export const ContactSection: React.FC = () => {
  const { locale } = useLocale();
  const contactContent = CONTACT_CONTENT_I18N[locale] || CONTACT_CONTENT_I18N.fr;
  const isAr = locale === 'ar';
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      schoolName: String(data.get('schoolName') ?? '').trim(),
      contactName: String(data.get('name') ?? '').trim(),
      city: String(data.get('city') ?? '').trim(),
      studentCount: String(data.get('studentCount') ?? ''),
      phone: String(data.get('phone') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
    };

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message ?? 'Erreur lors de l\'envoi.');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      ref={containerRef}
      id="contact"
      className="relative flex w-full items-center justify-center overflow-hidden bg-[#F8FAFC] px-4 py-16 sm:px-6 sm:py-20"
    >
      <div
        className="relative z-10 mx-auto w-full max-w-[1280px] overflow-hidden rounded-4xl p-6 text-white shadow-2xl sm:p-10 lg:rounded-[2.5rem] lg:p-16 xl:p-20"
        style={{
          backgroundImage: 'url(\'/assets/images/68a70580c8e48ada3b6c8187_Vibrant_Abstract_Streaks.avif\')',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

        <div
          className="relative z-10 grid w-full grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-16"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="flex flex-col justify-between py-2 text-start lg:col-span-5">
            <div className="flex max-w-xl flex-col gap-4">
              <h2 className="m-0 text-4xl leading-[1.05] font-normal tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.5rem]">
                {contactContent.title}
              </h2>
              <p className="m-0 max-w-lg text-base/relaxed text-white/75 sm:text-lg">
                {contactContent.subtitle}
              </p>
            </div>

            <div className="flex flex-col gap-7 pt-12 lg:pt-16">
              <div className="flex flex-col gap-1.5">
                <a
                  href={`tel:${contactContent.phone}`}
                  className="w-fit text-xl font-normal no-underline transition-colors hover:text-[#55B8E8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-2xl"
                  style={{ color: '#FFFFFF' }}
                >
                  {contactContent.phone}
                </a>
                <a
                  href={`mailto:${contactContent.email}`}
                  className="w-fit text-xl font-normal tracking-[-0.02em] break-all no-underline transition-colors hover:text-[#55B8E8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-2xl xl:text-3xl"
                  style={{ color: '#FFFFFF' }}
                >
                  {contactContent.email}
                </a>
              </div>

              <div className="flex items-center gap-4 pt-1 text-start text-white">
                <div className="relative flex h-8 w-[106px] items-center justify-start">
                  {contactContent.profiles.map((profile, index) => (
                    <div
                      key={profile.src}
                      className={`size-8 shrink-0 overflow-hidden rounded-full border border-white/60 ${index === 0 ? 'relative' : 'absolute'}`}
                      style={{ insetInlineStart: index === 0 ? undefined : `${index * 24}px` }}
                    >
                      <Image
                        src={profile.src}
                        alt={profile.alt}
                        width={32}
                        height={32}
                        className="aspect-square size-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <div style={{ color: '#FFFFFF' }}>
                  <div className="text-sm/snug font-medium">{contactContent.ratingText}</div>
                  <div className="text-xs/snug font-normal text-white/60">{contactContent.ratingSubtext}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:col-span-7">
            <div className="w-full rounded-3xl border border-white/10 bg-[#1A252B]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10">
              {submitted ? (
                <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-[#2487B8] text-2xl font-bold text-white">✓</div>
                  <h3 className="m-0 text-2xl font-medium text-white">
                    {isAr ? 'تم استلام طلبكم بنجاح' : 'Demande reçue !'}
                  </h3>
                  <p className="m-0 max-w-sm text-sm text-white/70">
                    {isAr
                      ? 'سيتواصل فريق SchoolOS مع مؤسستكم بخصوص المرحلة التجريبية القادمة.'
                      : 'L’équipe SchoolOS contactera votre établissement au sujet du prochain pilote.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
                  <WaitlistField
                    id="school-name"
                    name="schoolName"
                    autoComplete="organization"
                    label={isAr ? 'اسم المؤسسة *' : 'Nom de l’établissement *'}
                    placeholder={isAr ? 'مثال: مجموعة الأمل' : 'Groupe Scolaire Al Amal'}
                  />

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <WaitlistField
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      label={isAr ? 'اسم المسؤول *' : 'Nom du responsable *'}
                      placeholder={isAr ? 'الاسم الكامل' : 'M. Youssef El Amrani'}
                    />
                    <WaitlistField
                      id="school-city"
                      name="city"
                      autoComplete="address-level2"
                      label={isAr ? 'المدينة *' : 'Ville *'}
                      placeholder={isAr ? 'الدار البيضاء' : 'Casablanca'}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex w-full flex-col gap-2 text-start">
                      <label htmlFor="student-count" className="text-sm font-medium text-white/90">
                        {isAr ? 'عدد التلاميذ *' : 'Nombre d’élèves *'}
                      </label>
                      <select
                        id="student-count"
                        name="studentCount"
                        required
                        defaultValue="under-200"
                        style={fieldStyle}
                        className={fieldClassName}
                      >
                        <option value="under-200">{isAr ? 'أقل من 200' : 'Moins de 200'}</option>
                        <option value="200-600">200–600</option>
                        <option value="over-600">600+</option>
                      </select>
                    </div>
                    <WaitlistField
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      label={isAr ? 'الهاتف *' : 'Téléphone *'}
                      placeholder="06 12 34 56 78"
                    />
                  </div>

                  <WaitlistField
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required={false}
                    label={isAr ? 'البريد المهني' : 'Email professionnel'}
                    placeholder={isAr ? 'أدخل بريدك الإلكتروني' : 'Entrez votre adresse email'}
                  />

                  <p className="m-0 text-xs/relaxed text-white/60">
                    {isAr
                      ? 'بإرسال هذا النموذج، توافقون على أن نتواصل معكم بخصوص المرحلة التجريبية القادمة لـ SchoolOS. دون أي التزام بالشراء.'
                      : 'En envoyant ce formulaire, vous acceptez d’être contacté au sujet du prochain pilote SchoolOS. Aucune obligation d’achat.'}
                  </p>

                  {error && (
                    <p className="m-0 text-sm font-medium text-rose-300">
                      {error}
                    </p>
                  )}

                  <div className="pt-1 text-start">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-transparent bg-[#2487B8] py-1 pe-1.5 ps-5 text-sm font-medium text-white shadow-[0_5px_16px_rgba(36,135,184,0.3)] transition-colors hover:bg-[#1B6C93] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                    >
                      <span>
                        {loading
                          ? (isAr ? 'جارٍ الإرسال...' : 'Envoi...')
                          : (isAr ? 'الانضمام إلى قائمة الوصول المبكر' : 'Rejoindre la liste d’accès prioritaire')}
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2487B8] shadow-inner">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 32 32"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                          className={isAr ? 'rotate-180' : ''}
                          aria-hidden="true"
                        >
                          <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
