'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';
import { INTEGRATION_TOOLS_COL1, INTEGRATION_TOOLS_COL2 } from '../data/marketing-content';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const IntegrationSection: React.FC = () => {
  const { locale } = useLocale();
  const isAr = locale === 'ar';

  const containerRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLAnchorElement>(null);

  const upColRef = useRef<HTMLDivElement>(null);
  const downColRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      gsap.fromTo(
        containerRef.current.querySelector('.integration-info'),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 85%',
          },
        }
      );

      if (upColRef.current) {
        gsap.to(upColRef.current, {
          yPercent: -50,
          repeat: -1,
          duration: 18,
          ease: 'none',
        });
      }

      if (downColRef.current) {
        gsap.fromTo(
          downColRef.current,
          { yPercent: -50 },
          {
            yPercent: 0,
            repeat: -1,
            duration: 22,
            ease: 'none',
          }
        );
      }
    },
    { dependencies: [locale], scope: containerRef }
  );

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleMouseEnter = contextSafe(() => {
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

  const handleMouseLeave = contextSafe(() => {
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
    <section
      ref={containerRef}
      id="integration"
      style={{
        backgroundColor: '#F8FAFC',
        padding: '90px 0',
        width: '100%',
        fontFamily: 'Geist, "Albert Sans", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '60px',
          width: '100%',
        }}
      >
        
        {/* Left Information Column */}
        <div
          className="integration-info"
          style={{
            flex: 1,
            maxWidth: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            alignItems: 'flex-start',
            textAlign: isAr ? 'right' : 'left',
          }}
        >
          {/* Title */}
          <h2
            style={{
              fontSize: '38px',
              fontWeight: 800,
              color: '#16212B',
              margin: 0,
              letterSpacing: '-0.03em',
              lineHeight: '1.15',
            }}
          >
            {isAr ? 'ربط متكامل مع الأنظمة المعتمدة بالمغرب' : 'Intégrations puissantes'}
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '16px',
              color: '#5A6B7A',
              lineHeight: '1.6',
              margin: 0,
              maxWidth: '440px',
            }}
          >
            {isAr
              ? 'ربط مباشر لخدمة SchoolOS مع بوابات SMS المغربية (+212)، برامج المحاسبة وأنظمة الإدارة لربط وتحديث بياناتك تلقائياً.'
              : 'Connectez SchoolOS avec vos passerelles SMS (+212), vos outils comptables et logiciels de gestion pour tout synchroniser.'}
          </p>

          {/* Primary CTA Button */}
          <a
            ref={primaryBtnRef}
            href="#contact"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              height: '44px',
              paddingLeft: '22px',
              paddingRight: '6px',
              backgroundColor: '#2487B8',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(36, 135, 184, 0.25)',
              cursor: 'pointer',
              marginTop: '4px',
              marginBottom: '12px',
              border: 'none',
            }}
          >
            <span>{isAr ? 'استكشف أنظمة الربط المتاحة' : 'Découvrir les intégrations'}</span>
            
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                color: '#2487B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div className="slide-out-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
                  <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                </svg>
              </div>
              <div className="slide-in-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', opacity: 0, transform: 'translateX(-20px)', zIndex: 10 }}>
                <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
                  <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                </svg>
              </div>
            </div>
          </a>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', color: '#CBD5E1', padding: '16px 0' }}>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" /></svg>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" /></svg>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" /></svg>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" /></svg>
          </div>

          {/* 3 Numbered Steps List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: '#16212B',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                01
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                {isAr ? 'استكشف أكثر من 50 نظام ربط معتمد' : 'Explorez nos 50+ intégrations certifiées'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: '#16212B',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                02
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                {isAr ? 'ربط مباشر مع بوابات SMS والمحاسبة' : 'Connectez vos passerelles SMS & comptabilité'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: '#16212B',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                03
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                {isAr ? 'مزامنة وتسيير مؤتمت لمؤسستك بالكامل' : 'Synchronisez et automatisez votre établissement'}
              </div>
            </div>
          </div>

        </div>

        {/* Right Floating Ticker */}
        <div
          style={{
            width: '280px',
            height: '420px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            gap: '16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '80px',
              background: 'linear-gradient(180deg, #F8FAFC 0%, rgba(248, 250, 252, 0) 100%)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '80px',
              background: 'linear-gradient(0deg, #F8FAFC 0%, rgba(248, 250, 252, 0) 100%)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />

          {/* Col 1 */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
            <div ref={upColRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', willChange: 'transform' }}>
              {INTEGRATION_TOOLS_COL1.concat(INTEGRATION_TOOLS_COL1).concat(INTEGRATION_TOOLS_COL1).map((tool, idx) => (
                <div
                  key={`${tool.id}-${idx}`}
                  className="transition-all duration-300 hover:scale-110 cursor-pointer"
                  style={{ width: '92px', height: '92px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', flexShrink: 0 }}
                >
                  <Image src={tool.logoUrl} alt={tool.name} width={56} height={56} className="object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Col 2 */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%', paddingTop: '28px' }}>
            <div ref={downColRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', willChange: 'transform' }}>
              {INTEGRATION_TOOLS_COL2.concat(INTEGRATION_TOOLS_COL2).concat(INTEGRATION_TOOLS_COL2).map((tool, idx) => (
                <div
                  key={`${tool.id}-${idx}`}
                  className="transition-all duration-300 hover:scale-110 cursor-pointer"
                  style={{ width: '92px', height: '92px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', flexShrink: 0 }}
                >
                  <Image src={tool.logoUrl} alt={tool.name} width={56} height={56} className="object-contain" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
