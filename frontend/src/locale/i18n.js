import React, { createContext, useContext, useMemo } from 'react';
import ru from './ru';

const dictionaries = { ru };

const I18nContext = createContext({ t: (k, d) => k, locale: 'ru' });

export function I18nProvider({ locale = 'ru', children }) {
  const dict = dictionaries[locale] || dictionaries.ru;

  const t = useMemo(() => {
    const get = (path, params, defaultValue) => {
      try {
        const raw = path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), dict) ?? (defaultValue ?? path);
        if (typeof raw === 'string' && params && typeof params === 'object') {
          return Object.keys(params).reduce((out, k) => out.replaceAll(`{${k}}`, String(params[k])), raw);
        }
        return raw;
      } catch (_) {
        return defaultValue ?? path;
      }
    };
    return get;
  }, [dict]);

  const value = useMemo(() => ({ t, locale }), [t, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
