// WHY THIS FILE EXISTS
// --------------------
// Makes t() type-safe. By telling i18next that our resources have the exact shape
// of the English translation file, TypeScript will flag any t('some.missing.key')
// at compile time (tsc fails the build) instead of silently rendering the raw key
// at runtime. The English file is the canonical key set; the Croatian file mirrors it.

import 'i18next';
import type en from '../../public/locales/en/translation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
