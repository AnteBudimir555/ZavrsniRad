// WHY THIS FILE EXISTS
// --------------------
// Central MUI theme. We push the default font-size up and boost contrast so
// the UI is comfortable for non-technical users. Tweak colours here once and
// every MUI component follows.

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#ef6c00' },
    background: { default: '#f6f8fa' },
  },
  typography: {
    // Larger body text for readability.
    fontSize: 15,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
});
