import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useAuth } from './AuthContext';

// Listens for the 'session-expired' custom DOM event fired by the axios interceptor
// in api/client.ts whenever the backend returns 401 while the user is inside the app.
// Showing a dialog here is friendlier than the old silent redirect — the user sees
// an explanation instead of suddenly landing on the login page.
export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
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
      <DialogTitle>Session Expired</DialogTitle>
      <DialogContent>
        <Typography>Your session has expired. Please log in again.</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleLogin}>
          Go to Login
        </Button>
      </DialogActions>
    </Dialog>
  );
}
