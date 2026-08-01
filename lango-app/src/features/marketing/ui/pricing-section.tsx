'use client';

/**
 * PricingSection — Pure Tailwind CSS v4 + GSAP + React App Router Architecture (FR / AR i18n)
 */

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';
import { PRICING_TIERS_I18N, CONTACT_CONTENT_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// ─── Arrow SVG ───────────────────────────────────────────────────────────────
const ArrowSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm45.66-93.66a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32-11.32L148.69,136H88a8,8,0,0,1,0-16h60.69l-18.35-18.34a8,8,0,0,1,11.32-11.32Z" />
  </svg>
);

// ─── Check SVG ───────────────────────────────────────────────────────────────
const CheckSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
    <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" />
  </svg>
);

// ─── Plan icon SVGs ───────────────────────────────────────────────────────────
const PencilSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
    <path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM136,75.31,152.69,92,68,176.69,51.31,160ZM48,208V179.31L76.69,208Zm48-3.31L79.32,188,164,103.31,180.69,120Zm96-96L147.32,64l24-24L216,84.69Z" />
  </svg>
);

const SproutSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
    <path d="M247.63,47.89a8,8,0,0,0-7.52-7.52c-51.76-3-93.32,12.74-111.18,42.22-11.8,19.49-11.78,43.16-.16,65.74a71.34,71.34,0,0,0-14.17,27L98.33,159c7.82-16.33,7.52-33.35-1-47.49-13.2-21.79-43.67-33.47-81.5-31.25a8,8,0,0,0-7.52,7.52c-2.23,37.83,9.46,68.3,31.25,81.5A45.82,45.82,0,0,0,63.44,176,54.58,54.58,0,0,0,87,170.33l25,25V224a8,8,0,0,0,16,0V194.51a55.61,55.61,0,0,1,12.27-35,73.91,73.91,0,0,0,33.31,8.4,60.9,60.9,0,0,0,31.83-8.86C234.89,141.21,250.67,99.65,247.63,47.89ZM47.81,155.6C32.47,146.31,23.79,124.32,24,96c28.32-.24,50.31,8.47,59.6,23.81,4.85,8,5.64,17.33,2.46,26.94L61.65,122.34a8,8,0,0,0-11.31,11.31l24.41,24.41C65.14,161.24,55.82,160.45,47.81,155.6Zm149.31-10.22c-13.4,8.11-29.15,8.73-45.15,2l53.69-53.7a8,8,0,0,0-11.31-11.31L140.65,136c-6.76-16-6.15-31.76,2-45.15,13.94-23,47-35.82,89.33-34.83C232.94,98.34,220.14,131.44,197.12,145.38Z" />
  </svg>
);

const RocketSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
    <path d="M152,224a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,224Zm95.62-68.17-12.36,55.63a16,16,0,0,1-25.51,9.11L158.51,200h-61L70.25,220.57a16,16,0,0,1-25.51-9.11L32.38,155.83a16.09,16.09,0,0,1,3.32-13.71l28.56-34.26a123.07,123.07,0,0,1,8.57-36.67c12.9-32.34,36-52.63,45.37-59.85a16,16,0,0,1,19.6,0c9.34,7.22,32.47,27.51,45.37,59.85a123.07,123.07,0,0,1,8.57,36.67l28.56,34.26A16.09,16.09,0,0,1,247.62,155.83ZM128,112a12,12,0,1,0-12-12A12,12,0,0,0,128,112Z" />
  </svg>
);

const PLAN_ICONS: React.FC[] = [PencilSvg, SproutSvg, RocketSvg];

const CtaButton: React.FC<{ label: string; onClick: () => void; isAr: boolean }> = ({ label, onClick, isAr }) => {
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
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="h-10 pl-4 pr-1 py-0.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-full inline-flex items-center justify-between gap-2.5 shadow-[0_4px_14px_rgba(36,135,184,0.3)] transition-colors duration-200 cursor-pointer whitespace-nowrap border-none"
    >
      <span className="text-sm font-medium text-white">
        {label}
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

const PricingCard: React.FC<{
  tier: any;
  PlanIcon: React.FC;
  onDemo: () => void;
  isAr: boolean;
}> = ({ tier, PlanIcon, onDemo, isAr }) => (
  <div
    style={{ transformStyle: 'preserve-3d', transformOrigin: '50% 0%' }}
    className="pricing-card-3d flex flex-col gap-7 rounded-2xl bg-gradient-to-br from-black/75 to-black/45 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-8 items-start justify-start max-w-[460px] w-full border border-white/15"
  >
    <div className="pricing-main flex flex-col gap-5 items-start justify-start w-full">
      <div className="pricing-heading flex gap-2 items-center">
        <div className="pricing-icon p-1.5 rounded-full bg-white/10 text-white flex items-center justify-center">
          <div className="icon l w-embed">
            <PlanIcon />
          </div>
        </div>
        <h3 className="display-h4 m-0 text-[1.88rem] font-normal tracking-[-0.04em] leading-[1.2] text-white">
          {tier.planName}
        </h3>
        {tier.isMain && (
          <div className="tag px-2 py-1 rounded-full bg-[#fef7af] text-black text-[0.625rem] leading-tight uppercase tracking-wider font-bold flex items-center">
            {isAr ? 'الأكثر شعبية' : 'Populaire'}
          </div>
        )}
      </div>

      <div className="pricing-description flex flex-col gap-2 w-full">
        <div className="price flex items-center gap-2">
          <h4 className="display-h2 m-0 text-[3rem] font-normal tracking-[-0.05em] leading-none text-white">
            {tier.price}
          </h4>
          <div className="large-paragraph t---neutral-10 text-white/70 text-lg font-normal">
            {tier.currency} {tier.period}
          </div>
        </div>
        <p className="paragraph t---neutral-10 m-0 text-sm sm:text-[0.95rem] leading-relaxed font-normal text-white/70">
          {tier.description}
        </p>
      </div>

      <CtaButton label={isAr ? 'طلب عرض توضيحي' : 'Planifier une démo'} onClick={onDemo} isAr={isAr} />
    </div>

    <div className="check-list-wrap flex flex-col gap-3 w-full pt-2 border-t border-white/10">
      {tier.features.map((feat: string, i: number) => (
        <div key={i} className="icon-text flex items-center gap-2">
          <div className="icon m w-embed w-5 h-5 flex items-center justify-center shrink-0 text-white">
            <CheckSvg />
          </div>
          <p className="paragraph m-0 text-sm sm:text-[0.95rem] leading-relaxed font-normal text-white">
            {feat}
          </p>
        </div>
      ))}
    </div>
  </div>
);

export const PricingSection: React.FC = () => {
  const { locale } = useLocale();
  const pricingTiers = PRICING_TIERS_I18N[locale] || PRICING_TIERS_I18N.fr;
  const contactContent = CONTACT_CONTENT_I18N[locale] || CONTACT_CONTENT_I18N.fr;
  const isAr = locale === 'ar';

  const [activeTab, setActiveTab] = useState(1);
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const tabPanelsRef = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      if (!sectionRef.current || !cardsContainerRef.current) return;

      gsap.fromTo(
        cardsContainerRef.current.querySelectorAll('.pricing-card-3d'),
        {
          rotateX: 6,
          y: -10,
          transformOrigin: '50% 0%',
        },
        {
          rotateX: 0,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
            end: 'top 30%',
            scrub: 0.5,
          },
        }
      );
    },
    { dependencies: [locale], scope: sectionRef }
  );

  const handleTabSwitch = useCallback((idx: number) => {
    if (idx === activeTab) return;
    const oldPanel = tabPanelsRef.current[activeTab];
    const newPanel = tabPanelsRef.current[idx];

    if (oldPanel) {
      gsap.to(oldPanel, {
        opacity: 0,
        rotateX: 6,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          setActiveTab(idx);
          if (newPanel) {
            gsap.fromTo(
              newPanel,
              { opacity: 0, rotateX: -6 },
              { opacity: 1, rotateX: 0, duration: 0.35, ease: 'power3.out' }
            );
          }
        },
      });
    } else {
      setActiveTab(idx);
    }
  }, [activeTab]);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="section inverse w-full py-20 flex justify-center items-start relative overflow-hidden text-white"
      style={{
        borderRadius: '2.5rem',
      }}
    >
      <div className="container max-w-[1240px] w-full px-6 sm:px-12 mx-auto relative z-10">
        <div className="pricing-content-wrap w-full relative overflow-visible">
          
          <div className="grid grid-cols-12 gap-6 w-full overflow-visible items-start justify-between">
            
            {/* Left 4 cols */}
            <div className="col-span-12 lg:col-span-4 sticky top-32 self-start flex flex-col gap-6 z-20">
              <div className="pricing-header w-full max-w-[360px]">
                <div className="section-header flex items-center justify-start text-left">
                  <h2 className="display-h2 m-0 text-3xl sm:text-4xl lg:text-[2.5rem] font-normal tracking-[-0.05em] leading-[1.1] text-white">
                    {isAr ? 'تسعير مرن يناسب الجميع' : 'Tarification flexible'}
                  </h2>
                </div>
              </div>

              {/* Tabs menu */}
              <div id="w-node-tabs-menu" className="tabs-menu w-tab-menu p-1.5 gap-1.5 rounded-2xl bg-black/40 flex flex-col w-full border border-white/10">
                {pricingTiers.map((tier, idx) => {
                  const isActive = idx === activeTab;
                  const isHovered = idx === hoveredTab;
                  const showArrow = isActive || isHovered;

                  return (
                    <button
                      key={tier.id}
                      onClick={() => handleTabSwitch(idx)}
                      onMouseEnter={() => setHoveredTab(idx)}
                      onMouseLeave={() => setHoveredTab(null)}
                      className={`pricing-menu-item w-full p-3.5 rounded-xl flex justify-between items-center transition-all duration-300 cursor-pointer border-none text-left ${
                        isActive ? 'bg-white/15 opacity-100' : isHovered ? 'bg-white/10 opacity-90' : 'bg-white/5 opacity-70'
                      }`}
                    >
                      <div className="pricing-menu-text flex flex-col gap-0.5">
                        <div className="display-h6 text-base font-medium tracking-[-0.03em] text-white">
                          {tier.menuTitle}
                        </div>
                        <div className="small-paragraph text-sm font-normal text-white/60">
                          {tier.menuSubtitle}
                        </div>
                      </div>
                      <div
                        className={`pricing-arrow transition-all duration-350 ease-out ${
                          showArrow ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                        }`}
                      >
                        <div className="icon l w-embed flex items-center justify-center text-white">
                          <ArrowSvg />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Rating stack */}
              <div
                style={{ position: 'relative', marginTop: '0.5rem' }}
                className="custom-pricing-rating pt-2 hidden lg:block"
              >
                <div className="rating flex gap-3 items-center text-left">
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
                    <div className="small-paragraph text-sm font-medium">
                      {contactContent.ratingText}
                    </div>
                    <div className="small-paragraph text-sm text-white/60 font-normal">
                      {contactContent.ratingSubtext}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right 5-col width card */}
            <div
              ref={cardsContainerRef}
              id="w-node-tabs-content"
              style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
              className="col-span-12 lg:col-start-8 lg:col-span-5 flex justify-end w-full"
            >
              {pricingTiers.map((tier, idx) => {
                const isActive = idx === activeTab;
                const PlanIcon = PLAN_ICONS[idx] as React.FC;
                return (
                  <div
                    key={tier.id}
                    ref={(el) => { tabPanelsRef.current[idx] = el; }}
                    data-w-tab={`Tab ${idx + 1}`}
                    className={`tab-panel w-full ${isActive ? 'block' : 'hidden'}`}
                  >
                    <PricingCard
                      tier={tier}
                      PlanIcon={PlanIcon}
                      onDemo={() => setDemoOpen(true)}
                      isAr={isAr}
                    />
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </div>

      <div className="overlay-03 absolute inset-0 z-0 bg-black/65 pointer-events-none" aria-hidden />

      <div
        className="pricing-bg absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/images/68a70580c8e48ada3b6c8187_Vibrant_Abstract_Streaks.avif')" }}
        aria-hidden
      />
    </section>
  );
};
