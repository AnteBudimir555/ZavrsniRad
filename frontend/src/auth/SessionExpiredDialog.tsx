import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

// Listens for the 'session-expired' custom DOM event fired by the axios interceptor
// in api/client.ts whenever the backend returns 401 while the user is inside the app.
// Showing a dialog here is friendlier than the old silent redirect — the user sees
// an explanation instead of suddenly landing on the login page.
export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);

  function handleLogin() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  return (
    <Dialog open={open}>
      <DialogTitle>{t('session.title')}</DialogTitle>
      <DialogContent>
        <Typography>{t('session.body')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleLogin}>
          {t('session.goToLogin')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
