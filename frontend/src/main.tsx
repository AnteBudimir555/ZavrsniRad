// WHY THIS FILE EXISTS
// --------------------
// Bootstraps the React application: grabs the <div id="root"> from index.html,
// wraps the App in global providers (i18n, MUI theme, CSS baseline, Router, Auth),
// and hands everything to ReactDOM.

import React, { Suspense, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';

import App from './App';
import { buildTheme } from './theme';
import { AuthProvider } from './auth/AuthContext';
import { SUPPORTED_LNGS, type AppLanguage } from './i18n/config';
// Side-effect import: initialises i18next before anything renders.
import './i18n/config';

// Narrow i18next's free-form language string to one of our supported codes,
// defaulting to English. Used to pick the matching MUI theme locale bundle.
function asAppLanguage(lng: string): AppLanguage {
  return (SUPPORTED_LNGS as readonly string[]).includes(lng) ? (lng as AppLanguage) : 'en';
}

// Rebuilds the MUI theme whenever the language changes so built-in MUI component
// text follows the switcher, and keeps <html lang> in sync for accessibility/SEO.
function LocalizedThemeProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const lng = asAppLanguage(i18n.resolvedLanguage ?? i18n.language);
  const theme = useMemo(() => buildTheme(lng), [lng]);

  useEffect(() => {
    document.documentElement.lang = lng;
  }, [lng]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

// Centered spinner shown while the first translation file is being fetched.
function FullPageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Suspense catches the async load of the active language's JSON. */}
    <Suspense fallback={<FullPageLoader />}>
      <LocalizedThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </LocalizedThemeProvider>
    </Suspense>
  </React.StrictMode>,
);
