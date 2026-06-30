// WHY THIS FILE EXISTS
// --------------------
// Reusable language toggle. An IconButton shows the active language code (EN / HR)
// and opens a Menu listing the alternatives. Selecting one calls
// i18n.changeLanguage(), which updates the i18next context: every component using
// useTranslation() re-renders in place with the new copy — no page reload, and no
// component remounts, so form inputs / filters / pagination keep their state. The
// choice is persisted to LocalStorage by the detector config in i18n/config.ts.

import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemText } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LNGS, type AppLanguage } from '../i18n/config';

// Two-letter codes shown in the UI, one per supported language.
const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'EN',
  hr: 'HR',
};

interface Props {
  // Lets callers tint the button against a coloured surface (e.g. the AppBar).
  color?: 'inherit' | 'default' | 'primary';
}

export function LanguageSwitcher({ color = 'inherit' }: Props) {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // resolvedLanguage collapses regional tags (hr-HR → hr) to a code we ship.
  const current = (i18n.resolvedLanguage ?? 'en') as AppLanguage;

  const handleSelect = (lng: AppLanguage) => {
    void i18n.changeLanguage(lng);
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        color={color}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={t('common.changeLanguage')}
        aria-haspopup="menu"
        aria-controls={open ? 'language-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
      >
        <TranslateIcon fontSize="small" />
      </IconButton>

      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {SUPPORTED_LNGS.map((lng) => (
          <MenuItem
            key={lng}
            lang={lng}
            selected={lng === current}
            aria-current={lng === current ? 'true' : undefined}
            onClick={() => handleSelect(lng)}
          >
            <ListItemText>{LANGUAGE_LABELS[lng]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
