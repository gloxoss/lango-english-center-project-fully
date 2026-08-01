'use client';

import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocale } from '../context/locale-context';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const TESTIMONIALS_I18N = {
  fr: [
    {
      quote: 'SchoolOS nous a permis d’éliminer totalement le traitement manuel du papier. Les parents reçoivent les notifications d’absence instantanément.',
      author: 'Khadija El Mansouri',
      role: 'Directrice Pédagogique — GS Anfa',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7fa80bb87671d03408_Contemplative%20Woman%20in%20Vibrant%20Fashion.avif',
    },
    {
      quote: 'Travailler avec l’équipe SchoolOS est un vrai plaisir. La plateforme est intuitive, rapide et parfaitement adaptée aux exigences scolaires au Maroc.',
      author: 'Youssef Bennani',
      role: 'Fondateur — Établissement L’Écolier',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7fa80bb87671d03416_Dreamy%20Portrait%20of%20a%20Young%20Woman.avif',
    },
    {
      quote: 'Dès la première semaine, nous avons gagné un temps précieux sur le calcul des moyennes et la génération automatique des bulletins /20.',
      author: 'Amine Berrada',
      role: 'Directeur Général — Académie Al Atlas',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7f400136be769bc9dc_Modern%20Portrait%20Gradient.avif',
    },
  ],
  ar: [
    {
      quote: 'مكنتنا منصة SchoolOS من القضاء التام على المعالجة الورقية للغيابات. يتلقى أولياء الأمور الإشعارات فورياً عبر الهاتف.',
      author: 'خديجة المنصوري',
      role: 'المشرفة التربوية — مجموعة أنفة المدرسية',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7fa80bb87671d03408_Contemplative%20Woman%20in%20Vibrant%20Fashion.avif',
    },
    {
      quote: 'العمل مع فريق SchoolOS تجربة ممتازة. المنصة سهلة وسريعة ومصممة خصيصاً لمتطلبات المدارس ومراكز اللغات في المغرب.',
      author: 'يوسف بناني',
      role: 'مؤسس — مدرسة الإكوليي بالدار البيضاء',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7fa80bb87671d03416_Dreamy%20Portrait%20of%20a%20Young%20Woman.avif',
    },
    {
      quote: 'منذ الأسبوع الأول، وفرنا وقتاً ثميناً في حساب المعدلات وإنشاء كشوف النقاط التلقائية /20 دون أي خطأ.',
      author: 'أمين برادة',
      role: 'المدير العام — أكاديمية الأطلس بمراكش',
      photo: 'https://cdn.prod.website-files.com/68a413987ca3efce6f38ee67/68a71d7f400136be769bc9dc_Modern%20Portrait%20Gradient.avif',
    },
  ],
};

const QuoteSvg = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 8C6.68629 8 4 10.6863 4 14V22C4 23.1046 4.89543 24 6 24H12C13.1046 24 14 23.1046 14 22V16C14 14.8954 13.1046 14 12 14H8C8 11.7909 9.79086 10 12 10V8ZM24 8C20.6863 8 18 10.6863 18 14V22C18 23.1046 18.8954 24 20 24H26C27.1046 24 28 23.1046 28 22V16C28 14.8954 27.1046 14 26 14H22C22 11.7909 23.7909 10 26 10V8Z" />
  </svg>
);

export const TestimonialsSection: React.FC = () => {
  const { locale } = useLocale();
  const testimonials = TESTIMONIALS_I18N[locale] || TESTIMONIALS_I18N.fr;
  const isAr = locale === 'ar';

  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      gsap.fromTo(
        sectionRef.current.querySelectorAll('.testimonial-reveal'),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      );
    },
    { dependencies: [locale], scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="section w-full py-20 bg-[#F8FAFC] flex justify-center items-center relative overflow-hidden font-['Albert_Sans',sans-serif]"
    >
      <div className="container centered w-full max-w-[1240px] px-6 sm:px-12 mx-auto relative z-10 flex flex-col items-center gap-12">
        
        {/* Header */}
        <div className="section-header testimonial-reveal flex flex-col gap-3 items-center text-center max-w-[600px]">
          <h2 className="display-h2 m-0 text-3xl sm:text-4xl lg:text-[2.5rem] font-normal leading-[1.1] tracking-[-0.05em] text-[#16212B]">
            {isAr ? 'ماذا يقول مدراء المؤسسات' : 'Ce que disent nos directeurs'}
          </h2>
          <p className="large-paragraph t---neutral-10 m-0 text-base sm:text-lg leading-relaxed text-[#16212B]/70">
            {isAr
              ? 'اكتشف كيف تغير منصة SchoolOS الإدارة اليومية لمؤسساتهم التعليمية بالمغرب.'
              : 'Découvrez comment SchoolOS transforme au quotidien la gestion de leurs établissements.'}
          </p>
        </div>

        {/* Staggered Testimonials 3 Columns */}
        <div className="testimonial-section w-full grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {testimonials.map((item, idx) => {
            const staggerClasses = ['pt-0', 'md:pt-8', 'md:pt-16'];

            return (
              <div
                key={idx}
                className={`testimonial-reveal ${staggerClasses[idx]} w-full flex justify-center`}
              >
                <div className="testimonial p-6 sm:p-8 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_8px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between w-full max-w-[370px] min-h-[380px] transition-all duration-300 hover:shadow-[0_12px_36px_rgba(0,0,0,0.07)]">
                  
                  {/* Quote block */}
                  <div className="quote flex flex-col gap-4 items-start text-left">
                    <div className="quote-svg text-[#2487B8]">
                      <QuoteSvg />
                    </div>
                    <div className="large-paragraph t---neutral-10 text-base sm:text-lg leading-relaxed text-[#334155]">
                      "{item.quote}"
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="testimonial-profile flex items-end justify-between pt-6 gap-4 border-t border-[#F1F5F9]">
                    <div className="testimonial-info flex flex-col gap-0.5 text-left">
                      <div className="paragraph text-base font-semibold text-[#16212B]">
                        {item.author}
                      </div>
                      <div className="paragraph t---neutral-10 text-xs sm:text-sm text-[#64748B]">
                        {item.role}
                      </div>
                    </div>
                    <img
                      src={item.photo}
                      alt={item.author}
                      className="testimonial-profile-photo w-14 h-14 rounded-xl object-cover shrink-0 aspect-square border border-[#E2E8F0]"
                    />
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
