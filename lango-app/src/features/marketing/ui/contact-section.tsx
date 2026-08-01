'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
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
      className="section inverse w-full py-20 px-4 sm:px-6 flex justify-center items-center relative overflow-hidden"
    >
      {/* Big Dark Card Frame matching Webflow Original */}
      <div
        className="w-full max-w-[1280px] mx-auto rounded-[2.5rem] p-8 sm:p-14 lg:p-20 relative z-10 overflow-hidden text-white shadow-2xl"
        style={{
          backgroundImage: "url('/assets/images/68a70580c8e48ada3b6c8187_Vibrant_Abstract_Streaks.avif')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay matching Webflow opacity */}
        <div className="overlay-03 absolute inset-0 z-0 bg-black/60 pointer-events-none" />

        <div className="contact-section-wrap w-full relative z-10 grid grid-cols-12 gap-10 lg:gap-16 items-stretch">
          
          {/* Left Column: Heading, Subtitle & Contacts stacked at bottom */}
          <div className="col-span-12 lg:col-span-6 flex flex-col justify-between text-left py-2">
            
            {/* Top Heading */}
            <div className="contact-header flex flex-col gap-3">
              <h2 className="display-h2 m-0 text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.15] tracking-[-0.04em] text-white">
                {contactContent.title}
              </h2>
              <div className="large-paragraph text-base sm:text-lg leading-relaxed text-white/80 max-w-md mt-1">
                {contactContent.subtitle}
              </div>
            </div>

            {/* Bottom Contact Details & Avatars */}
            <div className="flex flex-col gap-6 pt-12 lg:pt-0">
              <div className="flex flex-col gap-1.5">
                <a
                  href={`tel:${contactContent.phone}`}
                  className="text-xl sm:text-2xl font-normal text-white hover:text-[#2487B8] transition-colors no-underline"
                >
                  {contactContent.phone}
                </a>
                <a
                  href={`mailto:${contactContent.email}`}
                  className="text-2xl sm:text-3xl font-normal text-white hover:text-[#2487B8] transition-colors no-underline tracking-[-0.02em]"
                >
                  {contactContent.email}
                </a>
              </div>

              {/* Rating Profiles Avatar Stack */}
              <div className="rating flex gap-4 items-center text-left pt-1">
                <div className="rating-profiles flex relative items-center justify-start w-[106px] h-8">
                  {contactContent.profiles.map((p, i) => {
                    const leftOffsets = [0, 24, 48, 72];
                    return (
                      <div
                        key={i}
                        className={`rating-profile _${i + 1} w-8 h-8 rounded-full border border-white/60 overflow-hidden shrink-0 ${
                          i === 0 ? 'relative' : 'absolute'
                        }`}
                        style={{ left: i === 0 ? undefined : `${leftOffsets[i]}px` }}
                      >
                        <Image
                          src={p.src}
                          alt={p.alt}
                          width={32}
                          height={32}
                          className="rating-profile-image object-cover w-full h-full aspect-square"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="rating-text text-white">
                  <div className="small-paragraph text-sm font-medium leading-snug">
                    {contactContent.ratingText}
                  </div>
                  <div className="small-paragraph text-xs text-white/60 font-normal leading-snug">
                    {contactContent.ratingSubtext}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Webflow Original 3-Field Dark Form Card */}
          <div className="col-span-12 lg:col-span-6 w-full">
            <div className="contact-form-wrap p-7 sm:p-10 rounded-3xl bg-[#1A252B]/90 border border-white/10 backdrop-blur-2xl shadow-2xl w-full">
              
              {submitted ? (
                <div className="py-12 px-6 text-center flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#FAF5E6] text-[#1A252B] flex items-center justify-center text-2xl font-bold">
                    ✓
                  </div>
                  <h3 className="text-2xl font-medium text-white m-0">
                    {isAr ? 'تم استلام طلبكم بنجاح' : 'Demande envoyée !'}
                  </h3>
                  <p className="text-sm text-white/70 m-0 max-w-sm">
                    {isAr
                      ? 'سيتواصل معكم فريقنا الاستشاري بالدار البيضاء في أقل من 24 ساعة.'
                      : 'Notre équipe vous contactera dans les 24 heures pour planifier la démonstration.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
                  
                  {/* Field 1: Name */}
                  <div className="input-field flex flex-col gap-2 text-left w-full">
                    <label className="text-sm font-medium text-white/90">
                      {isAr ? 'الاسم الكامل' : 'Nom complet *'}
                    </label>
                    <input
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="h-12 px-4 rounded-xl text-sm outline-none focus:border-[#2487B8] focus:bg-white/15 transition-all font-normal placeholder:text-white/40 w-full"
                      placeholder={isAr ? 'السيد العمراني' : 'Entrez votre nom'}
                      type="text"
                      required
                    />
                  </div>

                  {/* Field 2: Email */}
                  <div className="input-field flex flex-col gap-2 text-left w-full">
                    <label className="text-sm font-medium text-white/90">
                      {isAr ? 'البريد الإلكتروني *' : 'Email *'}
                    </label>
                    <input
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="h-12 px-4 rounded-xl text-sm outline-none focus:border-[#2487B8] focus:bg-white/15 transition-all font-normal placeholder:text-white/40 w-full"
                      placeholder={isAr ? 'البريد الإلكتروني' : 'Entrez votre adresse email'}
                      type="email"
                      required
                    />
                  </div>

                  {/* Field 3: Message */}
                  <div className="input-field flex flex-col gap-2 text-left w-full">
                    <label className="text-sm font-medium text-white/90">
                      {isAr ? 'الرسالة *' : 'Message *'}
                    </label>
                    <textarea
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      className="p-4 rounded-xl text-sm outline-none focus:border-[#2487B8] focus:bg-white/15 transition-all font-normal placeholder:text-white/40 min-h-[120px] resize-none w-full"
                      placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Entrez votre message'}
                      required
                    />
                  </div>

                  {/* Webflow Soft Cream Pill Button */}
                  <div className="pt-1 text-left">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-7 py-3 rounded-full bg-[#FAF5E6] hover:bg-[#F3ECE0] text-[#192429] font-medium text-sm transition-all cursor-pointer border-none shadow-md inline-flex items-center justify-center gap-2"
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
