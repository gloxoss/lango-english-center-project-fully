'use client';

import React, { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';
import { PROCESS_STEPS_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const ProcessSection: React.FC = () => {
  const { locale } = useLocale();
  const processSteps = PROCESS_STEPS_I18N[locale] || PROCESS_STEPS_I18N.fr;

  const [activeHoverIdx, setActiveHoverIdx] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current.querySelectorAll('.process-card'),
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.15,
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

  return (
    <section
      ref={containerRef}
      id="process"
      className="section"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div className="container centered">
        <div className="product-intro">
          
          {/* Main Hero UI Image */}
          <div className="main-ui">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/68a4af7ed724eae76593679d_Dashboard-2.avif"
              loading="lazy"
              alt="SchoolOS Dashboard Principal"
              className="main-ui-image"
            />
            <div
              className="main-ui-gradient"
              style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0), #F8FAFC 80%)' }}
            />
          </div>

          {/* 3 Process Cards */}
          <div
            className="process flex flex-col lg:flex-row gap-2.5 w-full bg-[#F1F5F9] p-2.5 rounded-[1.5rem]"
          >
            {processSteps.map((step, idx) => {
              const isActive = activeHoverIdx === idx;
              const bgCardImg =
                idx === 0
                  ? '/assets/images/68a4af78b97a579a98e7e732_Step_Card-1.png'
                  : idx === 1
                  ? '/assets/images/68a4af7b655f604c2a0e92ee_Step_Card-2.png'
                  : '/assets/images/68a4af7baceacb3162500e92_Step_Card-3.png';

              return (
                <div
                  key={step.stepNumber}
                  onMouseEnter={() => setActiveHoverIdx(idx)}
                  className="process-card"
                  style={{
                    width: isActive ? '50%' : '25%',
                    backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                    border: '1px solid #E2E8F0',
                    boxShadow: isActive ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
                    borderRadius: '1rem',
                    padding: '24px',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px', width: isActive ? '210px' : '100%' }}>
                      <div className="large-paragraph" style={{ color: '#2487B8', fontWeight: 700, fontSize: '18px' }}>
                        {step.stepNumber}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h2 className="display-h5" style={{ fontSize: '20px', fontWeight: 700, color: '#16212B', margin: 0 }}>
                          {step.title}
                        </h2>
                        <div className="paragraph" style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                          {step.description}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: isActive ? 'flex' : 'none',
                        flex: 1,
                        height: '260px',
                        borderRadius: '1rem',
                        position: 'relative',
                        overflow: 'hidden',
                        marginLeft: '16px',
                        backgroundImage: "url('/assets/images/68a6af7af1e741986b5d0da6_Dreamy_Abstract_Colors.avif')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '20px',
                          left: '20px',
                          width: '102%',
                          height: '102%',
                          border: '1px solid rgba(22, 33, 43, 0.1)',
                          borderRadius: '12px',
                          boxShadow: '-2px 4px 15px rgba(0,0,0,0.1)',
                          backgroundImage: `url('${bgCardImg}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'top left',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
};
