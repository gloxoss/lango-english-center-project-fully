'use client';

import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { useLocale } from '../context/locale-context';
import { CONTACT_CONTENT_I18N } from '../data/marketing-content';

export const ContactSection: React.FC = () => {
  const { locale } = useLocale();
  const contactContent = CONTACT_CONTENT_I18N[locale] || CONTACT_CONTENT_I18N.fr;
  const isAr = locale === 'ar';

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <section
      ref={containerRef}
      id="contact"
      className="
        relative flex w-full items-center justify-center overflow-hidden
        bg-[#F8FAFC] px-4 py-16
        sm:px-6 sm:py-20
      "
    >
      {/* Big Dark Card Frame matching Webflow Original */}
      <div
        className="
          relative z-10 mx-auto w-full max-w-[1280px] overflow-hidden
          rounded-4xl p-6 text-white shadow-2xl
          sm:p-10
          lg:rounded-[2.5rem] lg:p-16
          xl:p-20
        "
        style={{
          backgroundImage: 'url(\'/assets/images/68a70580c8e48ada3b6c8187_Vibrant_Abstract_Streaks.avif\')',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay matching Webflow opacity */}
        <div className="
          pointer-events-none absolute inset-0 z-0 bg-black/60
        "
        />

        <div
          className="
            relative z-10 grid w-full grid-cols-1 items-stretch gap-10
            lg:grid-cols-12 lg:gap-16
          "
          dir={isAr ? 'rtl' : 'ltr'}
        >

          {/* Left Column: Heading, Subtitle & Contacts stacked at bottom */}
          <div className="
            flex flex-col justify-between py-2 text-start
            lg:col-span-5
          "
          >

            {/* Top Heading */}
            <div className="flex max-w-xl flex-col gap-4">
              <h2 className="
                m-0 text-4xl leading-[1.05] font-normal tracking-[-0.04em]
                text-white
                sm:text-5xl
                lg:text-[3.5rem]
              "
              >
                {contactContent.title}
              </h2>
              <p className="
                m-0 max-w-lg text-base/relaxed text-white/75
                sm:text-lg
              "
              >
                {contactContent.subtitle}
              </p>
            </div>

            {/* Bottom Contact Details & Avatars */}
            <div className="
              flex flex-col gap-7 pt-12
              lg:pt-16
            "
            >
              <div className="flex flex-col gap-1.5">
                <a
                  href={`tel:${contactContent.phone}`}
                  className="
                    w-fit text-xl font-normal text-white no-underline
                    transition-colors
                    hover:text-[#55B8E8]
                    focus-visible:outline-2 focus-visible:outline-offset-4
                    focus-visible:outline-white
                    sm:text-2xl
                  "
                >
                  {contactContent.phone}
                </a>
                <a
                  href={`mailto:${contactContent.email}`}
                  className="
                    w-fit text-xl font-normal tracking-[-0.02em] break-all
                    text-white no-underline transition-colors
                    hover:text-[#55B8E8]
                    focus-visible:outline-2 focus-visible:outline-offset-4
                    focus-visible:outline-white
                    sm:text-2xl
                    xl:text-3xl
                  "
                >
                  {contactContent.email}
                </a>
              </div>

              {/* Rating Profiles Avatar Stack */}
              <div className="flex items-center gap-4 pt-1 text-start">
                <div className="
                  relative flex h-8 w-[106px] items-center justify-start
                "
                >
                  {contactContent.profiles.map((p, i) => {
                    const leftOffsets = [0, 24, 48, 72];
                    return (
                      <div
                        key={p.src}
                        className={`
                          size-8 shrink-0 overflow-hidden rounded-full border
                          border-white/60
                          ${
                      i === 0
                        ? 'relative'
                        : 'absolute'
                      }
                        `}
                        style={{
                          insetInlineStart: i === 0
                            ? undefined
                            : `${leftOffsets[i]}px`,
                        }}
                      >
                        <Image
                          src={p.src}
                          alt={p.alt}
                          width={32}
                          height={32}
                          className="aspect-square size-full object-cover"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-white">
                  <div className="text-sm/snug font-medium">
                    {contactContent.ratingText}
                  </div>
                  <div className="
                    text-xs/snug font-normal text-white/60
                  "
                  >
                    {contactContent.ratingSubtext}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Webflow Original 3-Field Dark Form Card */}
          <div className="
            w-full
            lg:col-span-7
          "
          >
            <div className="
              w-full rounded-3xl border border-white/10 bg-[#1A252B]/95 p-6
              shadow-2xl backdrop-blur-xl
              sm:p-8
              lg:p-10
            "
            >

              {submitted && (
                <div className="
                  flex flex-col items-center gap-4 px-6 py-12 text-center
                "
                >
                  <div className="
                    flex size-14 items-center justify-center rounded-full
                    bg-[#FAF5E6] text-2xl font-bold text-[#1A252B]
                  "
                  >
                    ✓
                  </div>
                  <h3 className="m-0 text-2xl font-medium text-white">
                    {isAr ? 'تم استلام طلبكم بنجاح' : 'Demande envoyée !'}
                  </h3>
                  <p className="m-0 max-w-sm text-sm text-white/70">
                    {isAr
                      ? 'سيتواصل معكم فريقنا الاستشاري بالدار البيضاء في أقل من 24 ساعة.'
                      : 'Notre équipe vous contactera dans les 24 heures pour planifier la démonstration.'}
                  </p>
                </div>
              )}

              {!submitted && (
                <form
                  onSubmit={handleSubmit}
                  className="flex w-full flex-col gap-6"
                >

                  {/* Field 1: Name */}
                  <div className="
                    flex w-full flex-col gap-2 text-start
                  "
                  >
                    <label
                      htmlFor="contact-name"
                      className="text-sm font-medium text-white/90"
                    >
                      {isAr ? 'الاسم الكامل' : 'Nom complet *'}
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="
                        h-12 w-full rounded-xl px-4 text-sm font-normal
                        transition-all outline-none
                        placeholder:text-white/40
                        focus:border-[#2487B8] focus:bg-white/15
                      "
                      placeholder={isAr ? 'السيد العمراني' : 'Entrez votre nom'}
                      type="text"
                      required
                    />
                  </div>

                  {/* Field 2: Email */}
                  <div className="
                    flex w-full flex-col gap-2 text-start
                  "
                  >
                    <label
                      htmlFor="contact-email"
                      className="text-sm font-medium text-white/90"
                    >
                      {isAr ? 'البريد الإلكتروني *' : 'Email *'}
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      autoComplete="email"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="
                        h-12 w-full rounded-xl px-4 text-sm font-normal
                        transition-all outline-none
                        placeholder:text-white/40
                        focus:border-[#2487B8] focus:bg-white/15
                      "
                      placeholder={isAr ? 'البريد الإلكتروني' : 'Entrez votre adresse email'}
                      type="email"
                      required
                    />
                  </div>

                  {/* Field 3: Message */}
                  <div className="
                    flex w-full flex-col gap-2 text-start
                  "
                  >
                    <label
                      htmlFor="contact-message"
                      className="text-sm font-medium text-white/90"
                    >
                      {isAr ? 'الرسالة *' : 'Message *'}
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="
                        min-h-[120px] w-full resize-none rounded-xl p-4 text-sm
                        font-normal transition-all outline-none
                        placeholder:text-white/40
                        focus:border-[#2487B8] focus:bg-white/15
                      "
                      placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Entrez votre message'}
                      required
                    />
                  </div>

                  {/* Webflow Soft Cream Pill Button */}
                  <div className="pt-1 text-start">
                    <button
                      type="submit"
                      disabled={loading}
                      className="
                        inline-flex min-h-12 w-full cursor-pointer items-center
                        justify-center gap-2 rounded-full border-none
                        bg-[#FAF5E6] px-7 py-3 text-sm font-semibold
                        text-[#192429] shadow-md transition-all
                        hover:-translate-y-0.5 hover:bg-white
                        focus-visible:outline-2 focus-visible:outline-offset-4
                        focus-visible:outline-white
                        disabled:cursor-wait disabled:opacity-70
                        sm:w-auto
                      "
                    >
                      <span>
                        {loading
                          ? (isAr ? 'جاري الإرسال...' : 'Envoi...')
                          : (isAr ? 'إرسال الرسالة' : 'Envoyer la demande')}
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
