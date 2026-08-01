'use client';

import React, { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';
import { FAQ_ITEMS_I18N } from '../data/marketing-content';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const PlusMinusIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const iconRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          rotate: isOpen ? 135 : 0,
          duration: 0.45,
          ease: 'power3.inOut',
        });
      }
    },
    { dependencies: [isOpen] }
  );

  return (
    <svg
      ref={iconRef}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 256 256"
      className="shrink-0 text-[#16212B]"
    >
      <path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" />
    </svg>
  );
};

export const FaqSection: React.FC = () => {
  const { locale } = useLocale();
  const faqItems = FAQ_ITEMS_I18N[locale] || FAQ_ITEMS_I18N.fr;
  const isAr = locale === 'ar';

  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current.querySelectorAll('.faq-item-reveal'),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          },
        }
      );
    },
    { dependencies: [locale], scope: sectionRef }
  );

  const toggleItem = (idx: number) => {
    const isCurrentlyOpen = openIdx === idx;
    const targetEl = contentRefs.current[idx];

    if (isCurrentlyOpen) {
      if (targetEl) {
        gsap.to(targetEl, {
          height: 0,
          opacity: 0,
          duration: 0.45,
          ease: 'power3.inOut',
          onComplete: () => setOpenIdx(null),
        });
      } else {
        setOpenIdx(null);
      }
    } else {
      if (openIdx !== null && contentRefs.current[openIdx]) {
        gsap.to(contentRefs.current[openIdx], {
          height: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'power3.inOut',
        });
      }
      setOpenIdx(idx);
      if (targetEl) {
        gsap.fromTo(
          targetEl,
          { height: 0, opacity: 0 },
          {
            height: 'auto',
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          }
        );
      }
    }
  };

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="section w-full py-20 bg-[#F8FAFC] flex justify-center items-start relative overflow-hidden"
    >
      <div className="container max-w-[1240px] w-full px-6 sm:px-12 mx-auto relative z-10">
        <div className="grid grid-cols-12 gap-8 lg:gap-12 w-full items-start">
          
          {/* Left Column: Sticky Header & Contact Card */}
          <div className="col-span-12 lg:col-span-4 sticky top-28 self-start flex flex-col gap-6">
            <div className="section-header flex flex-col gap-3 items-start text-left">
              <h2 className="display-h2 m-0 text-3xl sm:text-4xl lg:text-[2.5rem] font-normal leading-[1.1] tracking-[-0.05em] text-[#16212B]">
                {isAr ? 'أسئلتكم، إجاباتنا' : 'Vos questions, nos réponses'}
              </h2>
              <p className="large-paragraph t---neutral-10 m-0 text-base sm:text-lg leading-relaxed text-[#16212B]/70">
                {isAr
                  ? 'كل ما تريد معرفته عن منصة SchoolOS وكيفية ربطها بمؤسستك التعليمية بالمغرب.'
                  : 'Tout ce que vous devez savoir sur la plateforme SchoolOS et son intégration au sein de votre établissement.'}
              </p>
            </div>

            {/* Contact Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col gap-4 items-start text-left">
              <div className="flex flex-col gap-1">
                <div className="text-base font-semibold text-[#16212B]">
                  {isAr ? 'هل لديك سؤال آخر؟' : 'Une question spécifique ?'}
                </div>
                <div className="text-sm text-[#475569] leading-relaxed">
                  {isAr
                    ? 'فريقنا متاح للإجابة على جميع استفساراتك التقنية والتنظيمية.'
                    : 'Notre équipe est à votre disposition pour vous répondre en moins de 24h.'}
                </div>
              </div>
              
              <a
                href="#contact"
                style={{ backgroundColor: '#2487B8', color: '#ffffff' }}
                className="h-10 pl-4 pr-1.5 py-1 text-white font-medium text-xs rounded-full inline-flex items-center justify-between gap-3 shadow-[0_4px_14px_rgba(36,135,184,0.25)] hover:bg-[#1B6C93] transition-colors duration-300 no-underline"
              >
                <span>{isAr ? 'تواصل معنا' : 'Nous contacter'}</span>
                <div className="w-6 h-6 rounded-full bg-white text-[#2487B8] flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 32 32" fill="currentColor" className={isAr ? 'rotate-180' : ''}>
                    <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                  </svg>
                </div>
              </a>
            </div>
          </div>

          {/* Right Column: Accordion Items */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
            {faqItems.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={item.id}
                  className="faq-item-reveal rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all duration-300 overflow-hidden"
                >
                  <button
                    onClick={() => toggleItem(idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 border-none bg-transparent cursor-pointer"
                  >
                    <span className="text-lg font-medium text-[#16212B] tracking-[-0.03em]">
                      {item.question}
                    </span>
                    <PlusMinusIcon isOpen={isOpen} />
                  </button>

                  <div
                    ref={(el) => { contentRefs.current[idx] = el; }}
                    className={`overflow-hidden transition-all ${isOpen ? 'block' : 'hidden'}`}
                    style={{ height: isOpen ? 'auto' : 0 }}
                  >
                    <div className="px-6 pb-6 pt-0 text-base leading-relaxed text-[#475569] border-t border-[#F1F5F9]">
                      {item.answer}
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
