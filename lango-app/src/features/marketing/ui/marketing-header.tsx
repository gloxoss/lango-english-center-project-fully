'use client';

import React, { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useLocale } from '../context/locale-context';
import { DemoRequestModal } from './demo-request-modal';

gsap.registerPlugin(useGSAP);

interface MarketingHeaderProps {
  currentLocale?: string;
}

export const MarketingHeader: React.FC<MarketingHeaderProps> = ({ currentLocale }) => {
  const { locale, setLocale } = useLocale();
  const activeLocale = locale || (currentLocale === 'ar' ? 'ar' : 'fr');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      if (!dropdownRef.current) return;

      if (mobileMenuOpen) {
        gsap.fromTo(
          dropdownRef.current,
          { opacity: 0, y: -20, display: 'none' },
          { opacity: 1, y: 0, display: 'flex', duration: 0.35, ease: 'back.out(1.2)' }
        );
      } else {
        gsap.to(dropdownRef.current, {
          opacity: 0,
          y: -15,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            if (dropdownRef.current) {
              dropdownRef.current.style.display = 'none';
            }
          },
        });
      }
    },
    { dependencies: [mobileMenuOpen], scope: containerRef }
  );

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleButtonMouseEnter = contextSafe(() => {
    if (!buttonRef.current) return;
    const slideOut = buttonRef.current.querySelector('.slide-out-icon');
    const slideIn = buttonRef.current.querySelector('.slide-in-icon');

    if (slideOut && slideIn) {
      gsap.killTweensOf([slideOut, slideIn]);
      gsap.to(slideOut, { x: 20, opacity: 0, duration: 0.25, ease: 'power2.inOut' });
      gsap.fromTo(
        slideIn,
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.25, ease: 'power2.inOut' }
      );
    }
  });

  const handleButtonMouseLeave = contextSafe(() => {
    if (!buttonRef.current) return;
    const slideOut = buttonRef.current.querySelector('.slide-out-icon');
    const slideIn = buttonRef.current.querySelector('.slide-in-icon');

    if (slideOut && slideIn) {
      gsap.killTweensOf([slideOut, slideIn]);
      gsap.to(slideOut, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.inOut' });
      gsap.to(slideIn, { x: -20, opacity: 0, duration: 0.25, ease: 'power2.inOut' });
    }
  });

  const isAr = activeLocale === 'ar';

  return (
    <>
      <header
        ref={containerRef}
        className="fixed top-3 sm:top-5 left-0 right-0 z-[1000] flex justify-center items-center w-full px-3 sm:px-6 pointer-events-none"
      >
        <div className="w-full max-w-[1000px] mx-auto pointer-events-auto flex justify-center">
          
          <nav
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'nowrap',
              width: '100%',
              backgroundColor: '#FFFFFF',
              padding: '8px 20px',
              borderRadius: '9999px',
              boxShadow: '0 6px 30px rgba(0,0,0,0.08)',
              border: '1px solid #E2E8F0',
              margin: '0 auto',
            }}
          >
            
            {/* Logo */}
            <a
              href="#"
              className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity shrink-0 mr-2 sm:mr-4"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2487B8] flex items-center justify-center shadow-sm shrink-0">
                <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 30 L50 15 L80 30 L50 45 Z" fill="#FFFFFF" opacity="0.95" />
                  <path d="M20 45 L50 30 L80 45 L50 60 Z" fill="#FFFFFF" opacity="0.75" />
                  <path d="M20 60 L50 45 L80 60 L50 75 Z" fill="#FFFFFF" opacity="0.5" />
                </svg>
              </div>
              <span className="text-sm sm:text-base font-bold tracking-tight text-[#16212B] whitespace-nowrap">
                School<span className="text-[#2487B8]">OS</span>
              </span>
            </a>

            {/* Navigation Links */}
            <div
              className="hidden lg:flex items-center gap-4 xl:gap-5 text-xs sm:text-sm font-medium text-[#16212B] whitespace-nowrap"
            >
              <a href="#process" className="no-underline text-[#16212B] hover:text-[#2487B8] transition-colors" style={{ textDecoration: 'none' }}>
                {isAr ? 'طريقة العمل' : 'Comment ça marche'}
              </a>
              <a href="#features" className="no-underline text-[#16212B] hover:text-[#2487B8] transition-colors" style={{ textDecoration: 'none' }}>
                {isAr ? 'المميزات' : 'Fonctionnalités'}
              </a>
              <a href="#integration" className="no-underline text-[#16212B] hover:text-[#2487B8] transition-colors" style={{ textDecoration: 'none' }}>
                {isAr ? 'الربط المباشر' : 'Intégrations'}
              </a>
              <a href="#pricing" className="no-underline text-[#16212B] hover:text-[#2487B8] transition-colors" style={{ textDecoration: 'none' }}>
                {isAr ? 'الأسعار' : 'Tarifs MAD'}
              </a>
              <a href="#faq" className="no-underline text-[#16212B] hover:text-[#2487B8] transition-colors" style={{ textDecoration: 'none' }}>
                {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
              </a>
            </div>

            {/* Language Switcher + Demo CTA */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#F1F5F9',
                  padding: '3px 4px',
                  borderRadius: '9999px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <button
                  onClick={() => setLocale('fr')}
                  style={{
                    backgroundColor: activeLocale === 'fr' ? '#2487B8' : 'transparent',
                    color: activeLocale === 'fr' ? '#FFFFFF' : '#5A6B7A',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    lineHeight: '1',
                  }}
                  className="no-underline outline-none"
                >
                  FR
                </button>
                <span style={{ color: '#CBD5E1', fontSize: '11px', fontWeight: 600 }}>|</span>
                <button
                  onClick={() => setLocale('ar')}
                  style={{
                    backgroundColor: activeLocale === 'ar' ? '#2487B8' : 'transparent',
                    color: activeLocale === 'ar' ? '#FFFFFF' : '#5A6B7A',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    lineHeight: '1',
                  }}
                  className="no-underline outline-none"
                >
                  AR
                </button>
              </div>

              <button
                ref={buttonRef}
                onClick={() => setDemoModalOpen(true)}
                onMouseEnter={handleButtonMouseEnter}
                onMouseLeave={handleButtonMouseLeave}
                className="h-9 sm:h-10 pl-3.5 pr-1 py-0.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-semibold text-xs rounded-full flex items-center justify-between gap-2 shadow-[0_4px_14px_rgba(36,135,184,0.3)] transition-colors shrink-0 whitespace-nowrap cursor-pointer border border-transparent"
              >
                <span className="text-white font-medium pl-0.5 whitespace-nowrap">
                  {isAr ? 'طلب عرض توضيحي' : 'Demander une démo'}
                </span>
                
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-[#2487B8] flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
                  <div className="slide-out-icon flex items-center justify-center relative z-10">
                    <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
                      <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                    </svg>
                  </div>

                  <div className="slide-in-icon flex items-center justify-center absolute opacity-0 -translate-x-[20px] z-10">
                    <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
                      <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center gap-2 bg-[#2487B8] text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#1B6C93] transition-colors shrink-0 border-none cursor-pointer"
            >
              <span>{mobileMenuOpen ? (isAr ? 'إغلاق' : 'Fermer') : (isAr ? 'القائمة' : 'Menu')}</span>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

          </nav>

          {/* Mobile Dropdown Menu */}
          <div
            ref={dropdownRef}
            className="hidden flex-col items-center gap-3 bg-white text-[#16212B] rounded-2xl p-6 mt-3 border border-[#E2E8F0] shadow-2xl"
          >
            <a
              href="#process"
              onClick={() => setMobileMenuOpen(false)}
              className="no-underline text-sm font-semibold text-[#16212B] hover:text-[#2487B8] transition-colors"
            >
              {isAr ? 'طريقة العمل' : 'Comment ça marche'}
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="no-underline text-sm font-semibold text-[#16212B] hover:text-[#2487B8] transition-colors"
            >
              {isAr ? 'المميزات' : 'Fonctionnalités'}
            </a>
            <a
              href="#integration"
              onClick={() => setMobileMenuOpen(false)}
              className="no-underline text-sm font-semibold text-[#16212B] hover:text-[#2487B8] transition-colors"
            >
              {isAr ? 'الربط المباشر' : 'Intégrations'}
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="no-underline text-sm font-semibold text-[#16212B] hover:text-[#2487B8] transition-colors"
            >
              {isAr ? 'الأسعار' : 'Tarifs MAD'}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="no-underline text-sm font-semibold text-[#16212B] hover:text-[#2487B8] transition-colors"
            >
              {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
            </a>

            <div className="w-full h-[1px] bg-[#E2E8F0] my-1" />

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setDemoModalOpen(true);
              }}
              className="w-full py-3 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer border-none"
            >
              {isAr ? 'طلب عرض توضيحي' : 'Demander une démo'}
            </button>
          </div>

        </div>
      </header>

      <DemoRequestModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </>
  );
};
