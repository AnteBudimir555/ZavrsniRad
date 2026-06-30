// WHY THIS FILE EXISTS
// --------------------
// Login form. On success the AuthContext stores the JWT + role in localStorage
// and we navigate to wherever the user was trying to go (or "/").

import { useState, FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface LocationState { from?: { pathname: string } }

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      const to = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(to, { replace: true });
    } catch (e) {
      // Relay the backend's message when it's informative (e.g. "This account
      // has been deactivated."). Fall back to the generic line for anything
      // we don't recognise — including network errors with no response body.
      const serverMessage =
        axios.isAxiosError(e) ? e.response?.data?.message as string | undefined : undefined;
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      setError(status === 429
        ? t('auth.errors.rateLimited')
        : serverMessage ?? t('auth.errors.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: { xs: 3, sm: 8 } }}>
      <Paper elevation={2} sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5" gutterBottom>{t('auth.title')}</Typography>
        <Typography variant="body2" sx={{ mb: 3 }} color="text.secondary">
          {t('auth.subtitle')}
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField id="username" label={t('auth.username')} autoComplete="username"
                       value={username} onChange={(e) => setUsername(e.target.value)}
                       required autoFocus fullWidth />
            <TextField id="password" label={t('auth.password')} type="password" autoComplete="current-password"
                       value={password} onChange={(e) => setPassword(e.target.value)}
                       inputProps={{ minLength: 8 }} required fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? t('auth.submitting') : t('auth.submit')}
            </Button>
            <Typography variant="body2" align="center">
              {t('auth.newReporter')} <Link component={RouterLink} to="/register">{t('auth.createAccount')}</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
