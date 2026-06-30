// WHY THIS FILE EXISTS
// --------------------
// Boots i18next once, as a side-effect import from main.tsx. Three plugins:
//   - HttpBackend         → fetches /locales/{lng}/translation.json at runtime
//                           (the JSON lives in public/, served as static files by
//                           Nginx — no rebuild needed to tweak copy).
//   - LanguageDetector    → picks the language on first load (saved choice →
//                           browser language → <html lang>), English as fallback.
//   - initReactI18next    → wires i18next into React so useTranslation() re-renders
//                           components whenever the language changes.
//
// The detected/changed language is cached in LocalStorage ('i18nextLng'), so the
// preference survives reloads without any backend involvement.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Single source of truth for the languages we ship. `as const` keeps the literal
// union ('en' | 'hr') for strict typing in the switcher.
export const SUPPORTED_LNGS = ['en', 'hr'] as const;
export type AppLanguage = (typeof SUPPORTED_LNGS)[number];

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LNGS,
    // Map regional tags down to our base language: 'hr-HR' → 'hr', 'en-GB' → 'en'.
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      // React escapes values on render, so i18next doesn't need to (and double-
      // escaping would corrupt characters like Croatian č/š/ž in interpolations).
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      // LocalStorage first = the user's explicit choice wins over the browser.
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      // Persist the active language back to LocalStorage on every change.
      caches: ['localStorage'],
    },
    react: {
      // Lets components suspend while the first JSON file is fetched; main.tsx
      // provides the top-level <Suspense> fallback.
      useSuspense: true,
    },
  });

export default i18n;
