// WHY THIS FILE EXISTS
// --------------------
// Self-service registration for REPORTERS. Admin accounts are created by the
// backend's DataSeeder, never through this form.

import { useState, FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('register.errors.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      await register(username, password, email);
      navigate('/', { replace: true });
    } catch {
      setError(t('register.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: { xs: 3, sm: 8 } }}>
      <Paper elevation={2} sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5" gutterBottom>{t('register.title')}</Typography>
        <Typography variant="body2" sx={{ mb: 3 }} color="text.secondary">
          {t('register.subtitle')}
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField id="username" label={t('register.username')} autoComplete="username"
                       value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth />
            <TextField id="email" label={t('register.email')} type="email" autoComplete="email"
                       value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField id="password" label={t('register.password')} type="password"
                       autoComplete="new-password" value={password}
                       onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? t('register.submitting') : t('register.submit')}
            </Button>
            <Typography variant="body2" align="center">
              {t('register.alreadyHave')} <Link component={RouterLink} to="/login">{t('register.signIn')}</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
