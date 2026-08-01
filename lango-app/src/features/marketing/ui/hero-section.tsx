'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useLocale } from '../context/locale-context';
import { DemoRequestModal } from './demo-request-modal';
import { HERO_CONTENT_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP);

export const HeroSection: React.FC = () => {
  const { locale } = useLocale();
  const heroContent = HERO_CONTENT_I18N[locale] || HERO_CONTENT_I18N.fr;
  const isAr = locale === 'ar';

  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const heroContainerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline();

      if (headlineRef.current) {
        tl.from(headlineRef.current, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
        });
      }

      if (paragraphRef.current) {
        tl.from(
          paragraphRef.current,
          {
            y: 30,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
          },
          '-=0.5'
        );
      }

      if (buttonsRef.current) {
        tl.from(
          buttonsRef.current,
          {
            y: 25,
            opacity: 0,
            duration: 0.6,
            ease: 'power3.out',
          },
          '-=0.4'
        );
      }

      if (card1Ref.current && card2Ref.current) {
        tl.from(
          card1Ref.current,
          {
            scale: 0.92,
            opacity: 0,
            rotation: 0,
            duration: 0.9,
            ease: 'back.out(1.2)',
          },
          '-=0.6'
        ).from(
          card2Ref.current,
          {
            scale: 0.88,
            opacity: 0,
            rotation: 0,
            duration: 0.9,
            ease: 'back.out(1.2)',
          },
          '-=0.7'
        );

        gsap.to(card1Ref.current, {
          y: -6,
          duration: 3.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to(card2Ref.current, {
          y: 6,
          duration: 4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.5,
        });
      }

      if (tickerRef.current) {
        gsap.to(tickerRef.current, {
          xPercent: isAr ? 50 : -50,
          repeat: -1,
          duration: 28,
          ease: 'none',
        });
      }
    },
    { dependencies: [locale], scope: heroContainerRef }
  );

  const { contextSafe } = useGSAP({ scope: heroContainerRef });

  const handleButtonMouseEnter = contextSafe(() => {
    if (!primaryBtnRef.current) return;
    const slideOut = primaryBtnRef.current.querySelector('.slide-out-icon');
    const slideIn = primaryBtnRef.current.querySelector('.slide-in-icon');

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
    if (!primaryBtnRef.current) return;
    const slideOut = primaryBtnRef.current.querySelector('.slide-out-icon');
    const slideIn = primaryBtnRef.current.querySelector('.slide-in-icon');

    if (slideOut && slideIn) {
      gsap.killTweensOf([slideOut, slideIn]);
      gsap.to(slideOut, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.inOut' });
      gsap.to(slideIn, { x: -20, opacity: 0, duration: 0.25, ease: 'power2.inOut' });
    }
  });

  return (
    <>
      <section
        ref={heroContainerRef}
        className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 bg-[#F8FAFC] overflow-hidden border-b border-[#E2E8F0]"
      >
        {/* Background Canvas */}
        <div className="header-bg pointer-events-none cursor-none justify-between h-[70vh] flex absolute inset-0 z-0 overflow-hidden">
          <div className="relative z-10 w-[35%] flex overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-1 min-w-[72px] max-w-[80px] h-full bg-gradient-to-r from-white/80 to-transparent border-r border-slate-200/40"
              />
            ))}
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-r from-transparent to-[#F8FAFC] z-10" />
          </div>

          <div className="relative z-10 w-[35%] flex justify-end overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-1 min-w-[72px] max-w-[80px] h-full bg-gradient-to-r from-white/80 to-transparent border-r border-slate-200/40"
              />
            ))}
            <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-l from-transparent to-[#F8FAFC] z-10" />
          </div>

          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-b from-transparent to-[#F8FAFC] z-20" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Main Column */}
            <div className="lg:col-span-6 space-y-6 text-left">
              
              {/* Main Headline */}
              <h1
                ref={headlineRef}
                className="text-4xl sm:text-5xl lg:text-6xl font-normal text-[#16212B] tracking-[-0.05em] leading-[1.15]"
              >
                {heroContent.title}
              </h1>

              {/* Sub-headline Lead Copy */}
              <p
                ref={paragraphRef}
                className="text-base sm:text-lg text-[#5A6B7A] leading-relaxed max-w-xl font-normal"
              >
                {heroContent.subtitle}
              </p>

              {/* CTAs */}
              <div ref={buttonsRef} className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  ref={primaryBtnRef}
                  onClick={() => setDemoModalOpen(true)}
                  onMouseEnter={handleButtonMouseEnter}
                  onMouseLeave={handleButtonMouseLeave}
                  className="h-12 pl-5 pr-1.5 py-1 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-medium text-sm rounded-full flex items-center justify-between gap-3 shadow-[0_5px_16px_rgba(36,135,184,0.3)] transition-colors whitespace-nowrap cursor-pointer border border-transparent"
                >
                  <span>{heroContent.primaryCtaText}</span>
                  
                  <div className="w-8 h-8 rounded-full bg-white text-[#2487B8] flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
                    <div className="slide-out-icon flex items-center justify-center relative z-10">
                      <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={isAr ? 'rotate-180' : ''}>
                        <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                      </svg>
                    </div>

                    <div className="slide-in-icon flex items-center justify-center absolute opacity-0 -translate-x-[20px] z-10">
                      <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={isAr ? 'rotate-180' : ''}>
                        <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                      </svg>
                    </div>
                  </div>
                </button>

                <a
                  href="#features"
                  className="no-underline h-12 px-6 py-2 bg-transparent hover:bg-[#2487B8]/10 text-[#16212B] hover:text-[#2487B8] font-medium text-sm rounded-full flex items-center justify-center border border-[#16212B]/20 hover:border-[#2487B8] transition-all whitespace-nowrap"
                >
                  {heroContent.secondaryCtaText}
                </a>
              </div>

            </div>

            {/* Right Column */}
            <div className="lg:col-span-6 relative flex justify-center items-center min-h-[380px] sm:min-h-[440px]">
              <div
                ref={card1Ref}
                className="relative z-10 w-[88%] max-w-[460px] rounded-2xl overflow-hidden shadow-[2px_8px_24px_rgba(0,0,0,0.08)] bg-white transform rotate-[2deg]"
              >
                <Image
                  src={heroContent.heroCardMainUrl}
                  alt="SchoolOS Customer Dashboard UI"
                  width={920}
                  height={600}
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>

              <div
                ref={card2Ref}
                className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-20 w-[60%] max-w-[300px] rounded-2xl overflow-hidden shadow-[-2px_6px_24px_rgba(0,0,0,0.1)] bg-white/95 backdrop-blur-md transform -rotate-[3deg]"
              >
                <Image
                  src={heroContent.heroCardSecondaryUrl}
                  alt="SchoolOS Attendance Analytics Chart"
                  width={586}
                  height={400}
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>

            </div>

          </div>

          {/* Bottom Logo Ticker */}
          <div className="mt-20 pt-8 border-t border-[#E2E8F0] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#F8FAFC] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#F8FAFC] to-transparent z-10 pointer-events-none" />

            <div className="flex items-center">
              <div ref={tickerRef} className="flex items-center gap-12 shrink-0">
                {[...heroContent.tickerLogos, ...heroContent.tickerLogos, ...heroContent.tickerLogos].map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="h-8 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity gap-3">
                    <Image
                      src={item.logoUrl}
                      alt={item.name}
                      width={120}
                      height={32}
                      className="h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all"
                    />
                    <span className="text-xs font-semibold text-[#16212B]/70 whitespace-nowrap">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      <DemoRequestModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </>
  );
};
