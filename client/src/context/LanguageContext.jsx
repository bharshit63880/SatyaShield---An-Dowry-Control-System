import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';

const STORAGE_KEY = 'satyashield.ui.language';
const supported = new Set(['en', 'hi']);
const LanguageContext = createContext(null);

function interpolate(message, variables) {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    Object.hasOwn(variables, key) ? String(variables[key]) : `{${key}}`);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return supported.has(stored) ? stored : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Language is a non-sensitive preference; storage failure is harmless.
    }
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (supported.has(next)) setLanguageState(next);
  }, []);

  const t = useCallback((key, variables = {}) => {
    const message = translations[language]?.[key] ?? translations.en[key];
    if (message == null) {
      if (import.meta.env.DEV) return `⟦missing:${key}⟧`;
      return key;
    }
    return interpolate(message, variables);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider.');
  return value;
}
