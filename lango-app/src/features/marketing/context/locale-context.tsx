'use client';

/**
 * LocaleContext — Client-side locale state manager for Marketing i18n (FR / AR)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

type Locale = 'fr' | 'ar';
type Dir = 'ltr' | 'rtl';

interface LocaleContextType {
  locale: Locale;
  dir: Dir;
  setLocale: (loc: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode; initialLocale?: Locale }> = ({
  children,
  initialLocale = 'fr',
}) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const dir: Dir = locale === 'ar' ? 'rtl' : 'ltr';

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const toggleLocale = () => {
    setLocaleState((prev) => (prev === 'fr' ? 'ar' : 'fr'));
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  return (
    <LocaleContext.Provider value={{ locale, dir, setLocale, toggleLocale }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
