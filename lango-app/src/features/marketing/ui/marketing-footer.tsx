'use client';

import React, { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useLocale } from '../context/locale-context';
import { FOOTER_CONTENT_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP);

const NewsletterButton: React.FC<{ loading: boolean; isAr: boolean }> = ({ loading, isAr }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const slideInRef = useRef<HTMLDivElement>(null);
  const slideOutRef = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: btnRef });

  const onEnter = contextSafe(() => {
    if (!slideInRef.current || !slideOutRef.current) return;
    gsap.killTweensOf([slideInRef.current, slideOutRef.current]);
    gsap.to(slideOutRef.current, { x: 20, opacity: 0, duration: 0.25, ease: 'power2.in' });
    gsap.fromTo(slideInRef.current, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
  });

  const onLeave = contextSafe(() => {
    if (!slideInRef.current || !slideOutRef.current) return;
    gsap.killTweensOf([slideInRef.current, slideOutRef.current]);
    gsap.to(slideInRef.current, { x: -20, opacity: 0, duration: 0.25, ease: 'power2.in' });
    gsap.fromTo(slideOutRef.current, { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
  });

  return (
    <button
      ref={btnRef}
      type="submit"
      disabled={loading}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="h-10 pl-4 pr-1 py-0.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-medium text-sm rounded-full inline-flex items-center justify-between gap-2.5 shadow-[0_4px_14px_rgba(36,135,184,0.3)] transition-all duration-300 cursor-pointer overflow-hidden border-none shrink-0"
    >
      <span className="text-white font-medium tracking-tight whitespace-nowrap">
        {loading ? (isAr ? 'جاري الإرسال...' : 'Envoi...') : (isAr ? 'اشتراك' : "S'abonner")}
      </span>
      <div className="w-7 h-7 rounded-full bg-white text-[#2487B8] flex items-center justify-center relative overflow-hidden shrink-0">
        <div ref={slideOutRef} className="slide-out-icon relative z-10 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
            <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
          </svg>
        </div>
        <div ref={slideInRef} className="slide-in-icon absolute z-10 opacity-0 -translate-x-[20px] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
            <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
          </svg>
        </div>
      </div>
    </button>
  );
};

interface MarketingFooterProps {
  currentLocale?: string;
}

export const MarketingFooter: React.FC<MarketingFooterProps> = ({ currentLocale }) => {
  const { locale } = useLocale();
  const activeLocale = locale || (currentLocale === 'ar' ? 'ar' : 'fr');
  const footerContent = FOOTER_CONTENT_I18N[activeLocale] || FOOTER_CONTENT_I18N.fr;
  const isAr = activeLocale === 'ar';

  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubscribed(true);
    }, 600);
  };

  return (
    <footer className="w-full py-10 bg-[#F8FAFC] flex justify-center items-center relative font-['Albert_Sans',sans-serif]">
      <div className="w-full max-w-[1400px] px-6 sm:px-12 mx-auto">
        <div className="bg-white rounded-3xl p-8 sm:p-10 lg:p-12 border border-[#E2E8F0] shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col gap-10">
          
          <div className="flex flex-col lg:flex-row justify-between items-start w-full gap-8">
            
            {/* Newsletter Wrap */}
            <div className="flex flex-col gap-3 w-full lg:max-w-[480px]">
              <h4 className="m-0 text-2xl font-normal tracking-[-0.04em] text-[#16212B]">
                {footerContent.newsletterTitle}
              </h4>

              {subscribed ? (
                <div className="p-3.5 rounded-xl bg-[#2487B8]/10 text-[#2487B8] text-sm font-medium flex items-center gap-2">
                  <span>✓</span> {isAr ? 'تم تأكيد اشتراككم بنجاح. شكراً لكم!' : 'Votre abonnement est confirmé. Merci !'}
                </div>
              ) : (
                <form
                  onSubmit={handleSubscribe}
                  className="p-1.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 focus-within:border-[#2487B8] transition-colors"
                >
                  <input
                    className="flex-1 bg-transparent px-4 text-[#16212B] placeholder:text-[#16212B]/40 text-sm outline-none"
                    placeholder="nom@ecole.ma"
                    type="email"
                    required
                  />
                  <NewsletterButton loading={loading} isAr={isAr} />
                </form>
              )}
            </div>

            {/* Footer Navigation Links */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#16212B]/60 text-xs font-semibold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2487B8]" />
                <span>{isAr ? 'التصفح' : 'Navigation'}</span>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-base font-normal text-[#16212B]/80">
                {footerContent.navLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    className="no-underline text-[#16212B]/80 hover:text-[#2487B8] transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Block */}
          <div className="pt-8 border-t border-[#E2E8F0] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              {/* Social Icon Pills */}
              <div className="flex gap-2.5 items-center">
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-full bg-[#F1F5F9] hover:bg-[#2487B8] text-[#16212B] hover:text-white flex items-center justify-center transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M216,24H40A16,16,0,0,0,24,40V216a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V40A16,16,0,0,0,216,24Zm0,192H40V40H216V216ZM96,112v64a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0Zm88,28v36a8,8,0,0,1-16,0V140a20,20,0,0,0-40,0v36a8,8,0,0,1-16,0V112a8,8,0,0,1,15.79-1.78A36,36,0,0,1,184,140ZM100,84A12,12,0,1,1,88,72,12,12,0,0,1,100,84Z" />
                  </svg>
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Twitter"
                  className="w-10 h-10 rounded-full bg-[#F1F5F9] hover:bg-[#2487B8] text-[#16212B] hover:text-white flex items-center justify-center transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-[#F1F5F9] hover:bg-[#2487B8] text-[#16212B] hover:text-white flex items-center justify-center transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z" />
                  </svg>
                </a>
              </div>

              {/* Display Email */}
              <a
                href="mailto:contact@schoolos.ma"
                className="text-3xl sm:text-4xl font-normal tracking-[-0.05em] text-[#16212B] hover:text-[#2487B8] transition-colors duration-200 no-underline"
              >
                {footerContent.contactEmail}
              </a>
            </div>

            {/* Copyright Notice */}
            <div className="flex items-center gap-3 text-sm text-[#16212B]/60">
              <span>{footerContent.designedByText}</span>
              <span>•</span>
              <span>{footerContent.poweredByText}</span>
            </div>

          </div>

        </div>
      </div>
    </footer>
  );
};
