'use client';

import React, { useEffect, useState } from 'react';
import { Check, School, X } from 'lucide-react';
import { useLocale } from '../context/locale-context';

interface DemoRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClassName = `
  h-11 w-full rounded-xl border border-[#CFDAE4] bg-white px-3.5 text-sm
  text-[#16212B] outline-none transition-all placeholder:text-[#8FA0AE]
  focus:border-[#2487B8] focus:ring-2 focus:ring-[#2487B8]/20
`;

export const DemoRequestModal: React.FC<DemoRequestModalProps> = ({ isOpen, onClose }) => {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    city: 'Casablanca',
    email: '',
    fullName: '',
    phone: '',
    schoolName: '',
    schoolType: 'k12_private',
    studentCount: '200_600',
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  const closeModal = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden bg-[#16212B]/75 p-2 backdrop-blur-md sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="early-access-title"
        dir={isAr ? 'rtl' : 'ltr'}
        className="relative w-full max-w-[800px] overflow-hidden rounded-3xl border border-white/15 bg-[#F8FAFC] shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
      >
        <div className="flex items-start justify-between gap-5 border-b border-[#E2E8F0] bg-[#EDF3F8] px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2487B8] text-white shadow-sm">
              <School className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="m-0 text-xs font-semibold tracking-[0.12em] text-[#2487B8] uppercase">
                {isAr ? 'SchoolOS قريباً' : 'SchoolOS arrive bientôt'}
              </p>
              <h2
                id="early-access-title"
                className="m-0 mt-0.5 text-xl leading-tight font-semibold tracking-[-0.03em] text-[#16212B] sm:text-2xl"
              >
                {isAr ? 'الانضمام إلى قائمة الوصول المبكر' : 'Rejoindre la liste d’accès prioritaire'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#D7E0E8] bg-white text-[#5A6B7A] transition-colors hover:border-[#2487B8] hover:text-[#2487B8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2487B8]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 sm:px-6 sm:py-5">
          {submitted ? (
            <div className="flex flex-col items-center py-8 text-center sm:py-10">
              <span className="flex size-16 items-center justify-center rounded-full bg-[#DDF5EC] text-[#15835D]">
                <Check className="size-8" aria-hidden="true" />
              </span>
              <h3 className="m-0 mt-5 text-2xl font-semibold text-[#16212B]">
                {isAr ? 'تم استلام طلبكم' : 'Votre demande a bien été reçue'}
              </h3>
              <p className="m-0 mt-2 max-w-md text-sm/relaxed text-[#5A6B7A]">
                {isAr
                  ? `شكراً ${formData.fullName}. سيتواصل فريق SchoolOS مع مؤسستكم بخصوص المرحلة التجريبية القادمة.`
                  : `Merci ${formData.fullName}. L’équipe SchoolOS contactera votre établissement au sujet du prochain pilote.`}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="mt-6 min-h-11 cursor-pointer rounded-full border-0 bg-[#2487B8] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1B6C93]"
                style={{ color: '#FFFFFF' }}
              >
                {isAr ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="m-0 text-sm/relaxed text-[#5A6B7A]">
                {isAr
                  ? 'أخبرونا عن مؤسستكم لنتواصل معكم عند فتح المرحلة التجريبية لـ SchoolOS في المغرب.'
                  : 'Présentez-nous votre établissement afin que nous puissions vous contacter lors de l’ouverture du pilote SchoolOS au Maroc.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'اسم المسؤول *' : 'Nom du responsable *'}
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder={isAr ? 'الاسم الكامل' : 'M. Youssef El Amrani'}
                    value={formData.fullName}
                    onChange={event => setFormData({ ...formData, fullName: event.target.value })}
                    className={inputClassName}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'اسم المؤسسة *' : 'Nom de l’établissement *'}
                  <input
                    type="text"
                    required
                    autoComplete="organization"
                    placeholder={isAr ? 'مجموعة الأمل' : 'Groupe Scolaire Al Amal'}
                    value={formData.schoolName}
                    onChange={event => setFormData({ ...formData, schoolName: event.target.value })}
                    className={inputClassName}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'نوع المؤسسة *' : 'Type d’établissement *'}
                  <select
                    value={formData.schoolType}
                    onChange={event => setFormData({ ...formData, schoolType: event.target.value })}
                    className={inputClassName}
                  >
                    <option value="k12_private">{isAr ? 'مدرسة خاصة' : 'École privée (K-12)'}</option>
                    <option value="language_center">{isAr ? 'مركز لغات' : 'Centre de langues'}</option>
                    <option value="education_center">{isAr ? 'مركز تعليمي' : 'Centre éducatif'}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'المدينة *' : 'Ville *'}
                  <input
                    type="text"
                    required
                    autoComplete="address-level2"
                    placeholder={isAr ? 'الدار البيضاء' : 'Casablanca'}
                    value={formData.city}
                    onChange={event => setFormData({ ...formData, city: event.target.value })}
                    className={inputClassName}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'عدد التلاميذ *' : 'Nombre d’élèves *'}
                  <select
                    value={formData.studentCount}
                    onChange={event => setFormData({ ...formData, studentCount: event.target.value })}
                    className={inputClassName}
                  >
                    <option value="under_200">{isAr ? 'أقل من 200' : 'Moins de 200'}</option>
                    <option value="200_600">200–600</option>
                    <option value="over_600">600+</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'الهاتف *' : 'Téléphone *'}
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="06 12 34 56 78"
                    value={formData.phone}
                    onChange={event => setFormData({ ...formData, phone: event.target.value })}
                    className={inputClassName}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#16212B]">
                  {isAr ? 'البريد المهني (اختياري)' : 'Email professionnel (facultatif)'}
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="contact@ecole.ma"
                    value={formData.email}
                    onChange={event => setFormData({ ...formData, email: event.target.value })}
                    className={inputClassName}
                  />
                </label>
              </div>

              <p className="m-0 text-xs/relaxed text-[#6F7F8D]">
                {isAr
                  ? 'بإرسال هذا النموذج، توافقون على أن نتواصل معكم بخصوص SchoolOS. دون أي التزام بالشراء.'
                  : 'En envoyant ce formulaire, vous acceptez d’être contacté au sujet de SchoolOS. Aucune obligation d’achat.'}
              </p>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-full border-0 bg-[#2487B8] py-1 pe-1.5 ps-5 text-sm font-semibold text-white shadow-[0_5px_16px_rgba(36,135,184,0.3)] transition-colors hover:bg-[#1B6C93] disabled:cursor-wait disabled:opacity-70"
                style={{ color: '#FFFFFF' }}
              >
                <span>
                  {loading
                    ? (isAr ? 'جارٍ الإرسال...' : 'Envoi...')
                    : (isAr ? 'الانضمام إلى قائمة الوصول المبكر' : 'Rejoindre la liste d’accès prioritaire')}
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2487B8] shadow-inner">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 32 32"
                    fill="currentColor"
                    className={isAr ? 'rotate-180' : ''}
                    aria-hidden="true"
                  >
                    <path d="M28.0613 17.0612L19.0613 26.0612C18.7795 26.343 18.3973 26.5013 17.9988 26.5013C17.6002 26.5013 17.218 26.343 16.9363 26.0612C16.6545 25.7794 16.4961 25.3972 16.4961 24.9987C16.4961 24.6002 16.6545 24.218 16.9363 23.9362L23.375 17.5H5C4.60218 17.5 4.22064 17.3419 3.93934 17.0606C3.65804 16.7793 3.5 16.3978 3.5 16C3.5 15.6022 3.65804 15.2206 3.93934 14.9393C4.22064 14.658 4.60218 14.5 5 14.5H23.375L16.9387 8.05998C16.657 7.77818 16.4986 7.39599 16.4986 6.99747C16.4986 6.59896 16.657 6.21677 16.9387 5.93497C17.2205 5.65318 17.6027 5.49487 18.0012 5.49487C18.3998 5.49487 18.782 5.65318 19.0637 5.93497L28.0637 14.935C28.2036 15.0745 28.3145 15.2403 28.3901 15.4228C28.4657 15.6054 28.5045 15.801 28.5043 15.9986C28.5041 16.1962 28.4648 16.3918 28.3888 16.5741C28.3127 16.7565 28.2014 16.922 28.0613 17.0612Z" />
                  </svg>
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
