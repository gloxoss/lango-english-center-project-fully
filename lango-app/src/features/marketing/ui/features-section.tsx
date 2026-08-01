'use client';

import React, { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';
import { FEATURE_TABS_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const FeaturesSection: React.FC = () => {
  const { locale } = useLocale();
  const featureTabs = FEATURE_TABS_I18N[locale] || FEATURE_TABS_I18N.fr;
  const isAr = locale === 'ar';

  const [activeTab, setActiveTab] = useState<number>(3);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current.querySelector('.feature-header'),
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
      }
    },
    { dependencies: [locale], scope: containerRef }
  );

  useGSAP(
    () => {
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current,
          { opacity: 0, scale: 0.99, y: 6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power2.out' }
        );
      }
    },
    { dependencies: [activeTab, locale], scope: containerRef }
  );

  const currentTabObj = featureTabs[activeTab] || featureTabs[3];

  return (
    <section
      ref={containerRef}
      id="features"
      style={{ backgroundColor: '#F8FAFC', padding: '80px 0', width: '100%', fontFamily: 'Geist, "Albert Sans", sans-serif' }}
    >
      <div style={{ maxWidth: '1020px', margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Section Header */}
        <div className="feature-header" style={{ textAlign: 'center', maxWidth: '640px', marginBottom: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#2487B8',
              backgroundColor: 'rgba(36, 135, 184, 0.1)',
              padding: '5px 14px',
              borderRadius: '9999px',
            }}
          >
            {isAr ? 'المميزات الرئيسية' : 'FONCTIONNALITÉS CLÉS'}
          </span>
          <h2 style={{ fontSize: '34px', fontWeight: 800, color: '#16212B', margin: 0, letterSpacing: '-0.03em', lineHeight: '1.15' }}>
            {isAr ? 'مصممة للأداء المالي والأكاديمي الفائق' : 'Conçu pour la haute performance scolaire'}
          </h2>
          <div style={{ fontSize: '15px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
            {isAr
              ? 'تمنح منصة SchoolOS إدارتك وأساتذتك كل ما يحتاجونه لمتابعة التقدم والتسيير في الوقت الفعلي.'
              : 'SchoolOS donne à vos équipes administratives et enseignantes tout ce dont elles ont besoin pour suivre les progrès et la gestion en temps réel.'}
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#F1F5F9',
            padding: '6px',
            borderRadius: '9999px',
            marginBottom: '36px',
            width: '100%',
            maxWidth: '940px',
            border: '1px solid #E2E8F0',
          }}
        >
          {featureTabs.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  opacity: isActive ? 1 : 0.75,
                  boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.06)' : 'none',
                  border: isActive ? '1px solid #E2E8F0' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isActive ? '#2487B8' : '#334155',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#2487B8' : '#64748B' }}>
                  {idx === 0 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M240,192h-8V168a8,8,0,0,0-8-8H160a8,8,0,0,0-8,8v24H40V56H216v80a8,8,0,0,0,16,0V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Zm-72-16h48v16H168Z" /></svg>
                  )}
                  {idx === 1 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z" /></svg>
                  )}
                  {idx === 2 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z" /></svg>
                  )}
                  {idx === 3 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M152,80a8,8,0,0,1,8-8h88a8,8,0,0,1,0,16H160A8,8,0,0,1,152,80Zm96,40H160a8,8,0,0,0,0,16h88a8,8,0,0,0,0-16Zm0,48H184a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm-96.25,22a8,8,0,0,1-5.76,9.74,7.55,7.55,0,0,1-2,.26,8,8,0,0,1-7.75-6c-6.16-23.94-30.34-42-56.25-42s-50.09,18.05-56.25,42a8,8,0,0,1-15.5-4c5.59-21.71,21.84-39.29,42.46-48a48,48,0,1,1,58.58,0C129.91,150.71,146.16,168.29,151.75,190ZM80,136a32,32,0,1,0-32-32A32,32,0,0,0,80,136Z" /></svg>
                  )}
                </div>
                <span>{tab.tag}</span>
              </button>
            );
          })}
        </div>

        {/* Main Feature Content Card */}
        <div
          ref={contentRef}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '36px',
            backgroundColor: '#FFFFFF',
            borderRadius: '1.5rem',
            padding: '28px',
            boxShadow: '0 12px 35px rgba(0,0,0,0.03)',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '940px',
            minHeight: '400px',
          }}
        >
          
          {/* Left UI Image Canvas */}
          <div
            style={{
              width: '50%',
              height: '360px',
              borderRadius: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: "url('/assets/images/68a6af7af1e741986b5d0da6_Dreamy_Abstract_Colors.avif')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #E2E8F0',
            }}
          >
            {activeTab === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '28px',
                  left: '28px',
                  width: '110%',
                  height: '110%',
                  borderRadius: '14px 0 0 0',
                  backgroundImage: "url('/assets/images/68a492d1b6570b95dd597824_Customer_Card.png')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'top left',
                  boxShadow: '-4px 4px 20px rgba(0,0,0,0.15)',
                }}
              />
            )}

            {activeTab === 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: '28px',
                  right: '28px',
                  height: '75%',
                  maxHeight: '260px',
                }}
              >
                <div style={{ position: 'absolute', inset: '-4% 20px 4%', backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: '12px' }} />
                <div style={{ position: 'absolute', inset: '-2% 10px 2%', backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '12px' }} />
                <div
                  style={{
                    position: 'absolute',
                    inset: '0%',
                    borderRadius: '12px',
                    backgroundImage: "url('/assets/images/68a4af6379634f53e60e3f1b_Revenue_Card.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'top left',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}
                />
              </div>
            )}

            {activeTab === 2 && (
              <div
                style={{
                  width: '65%',
                  height: '65%',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.7)',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '0%',
                    backgroundImage: "url('/assets/images/68a4af6f92cfc6de1cfe10dc_Task_Card.png')",
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    transform: 'rotate(3deg) translate(8px, -8px)',
                  }}
                />
              </div>
            )}

            {activeTab === 3 && (
              <div
                style={{
                  position: 'absolute',
                  inset: '12% 28px 0',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '14px 14px 0 0',
                    backgroundImage: "url('/assets/images/68a4af8269dc1ef2ce14b1f9_Welcome_Card.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'top center',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '220px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundImage: "url('/assets/images/68a4af74b2e4e34cd6835eb4_Invite.png')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                      zIndex: 10,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Text & Info Box */}
          <div
            style={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '14px',
              textAlign: isAr ? 'right' : 'left',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#2487B8',
                backgroundColor: 'rgba(36, 135, 184, 0.1)',
                padding: '4px 12px',
                borderRadius: '9999px',
              }}
            >
              {currentTabObj?.tag}
            </div>

            <h3
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: '#16212B',
                lineHeight: '1.2',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {currentTabObj?.title}
            </h3>

            <p
              style={{
                fontSize: '14px',
                color: '#475569',
                lineHeight: '1.6',
                margin: 0,
              }}
            >
              {currentTabObj?.description}
            </p>

            <div
              style={{
                marginTop: '8px',
                paddingTop: '14px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#2487B8',
              }}
            >
              <span>{isAr ? 'خاصية متاحة على منصة SchoolOS' : 'Fonctionnalité disponible sur SchoolOS'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isAr ? 'rotate-180' : ''}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
