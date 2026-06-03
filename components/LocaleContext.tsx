import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Locale = 'fr' | 'ar';

export const LocaleContext = createContext<{
  locale: Locale;
  setLang: (l: Locale) => void;
  toggleLang: () => void;
}>({
  locale: 'fr',
  setLang: () => {},
  toggleLang: () => {},
});

export function LocaleContextProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  useEffect(() => {
    AsyncStorage.getItem('locale').then(val => {
      if (val === 'fr' || val === 'ar') setLocaleState(val);
    });
  }, []);

  const setLang = (l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem('locale', l);
  };

  const toggleLang = () => {
    setLang(locale === 'fr' ? 'ar' : 'fr');
  };

  return (
    <LocaleContext.Provider value={{ locale, setLang, toggleLang }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
