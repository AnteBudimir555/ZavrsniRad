// WHY THIS FILE EXISTS
// --------------------
// Central MUI theme. We push the default font-size up and boost contrast so
// the UI is comfortable for non-technical users. Tweak colours here once and
// every MUI component follows.
//
// MOBILE FOUNDATION (M1)
// ----------------------
// Three things are set here so every screen benefits without per-component work:
//   1. fontFamily   — a native system-font stack. The browser already has these
//                     fonts, so there is ZERO font download (faster first paint)
//                     and text matches the OS (San Francisco on iOS, Segoe UI on
//                     Windows, Roboto on Android) → "native feel". Previously MUI
//                     assumed Roboto, which was never actually loaded.
//   2. 48px targets — MuiButton/MuiIconButton get a 48px minimum hit area. The
//                     W3C touch-target guideline is 48x48px; MUI's default button
//                     is only ~36px tall, too small for a thumb. Setting it once
//                     here fixes every button app-wide.
//   3. responsiveFontSizes() — wraps the theme so headings scale DOWN on small
//                     screens automatically (an h5 that fits a laptop is oversized
//                     on a 320px phone). No manual per-variant breakpoints needed.

import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { enUS, hrHR } from '@mui/material/locale';
import type { AppLanguage } from './i18n/config';

const baseTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#ef6c00' },
    background: { default: '#f6f8fa' },
  },
  typography: {
    // Native system-font stack — no web-font download, OS-native look.
    fontFamily: [
      '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
      '"Helvetica Neue"', 'Arial', 'sans-serif',
    ].join(','),
    // Larger body text for readability.
    fontSize: 15,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    // 48px minimum touch target on every button (incl. size="small").
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 48 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 48, minHeight: 48 },
      },
    },
  },
});

// MUI ships its own copy for built-in component text (e.g. the Autocomplete
// "no options" / TablePagination labels). Merging the matching locale bundle in
// keeps those strings in sync with the app language chosen in the switcher.
const muiLocales = { en: enUS, hr: hrHR } as const;

// Build the theme for a given language. createTheme(base, locale) merges the MUI
// locale on top of our base theme; responsiveFontSizes then scales headings down
// on small screens. main.tsx calls this whenever i18n.language changes.
export function buildTheme(lng: AppLanguage) {
  return responsiveFontSizes(createTheme(baseTheme, muiLocales[lng]));
}

// Default English theme — used as the synchronous initial value.
export const theme = buildTheme('en');
