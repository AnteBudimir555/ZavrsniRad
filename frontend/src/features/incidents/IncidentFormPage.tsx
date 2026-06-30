// WHY THIS FILE EXISTS
// --------------------
// The form reporters use to log a new incident. UI goals:
//   - Short, clearly-labelled fields (non-tech staff target audience).
//   - Helpful inline error messages; never dump a raw API error at the user.
//   - Big primary button, plenty of spacing.

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Container, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { incidentsApi, IncidentCategory, IncidentSeverity } from '../../api/incidents';

const CATEGORIES: IncidentCategory[] = ['SAFETY', 'IT', 'FACILITY', 'OTHER'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time (no zone, no seconds).
function nowAsLocalDatetimeInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function IncidentFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('OTHER');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  // Default to "now" so a reporter logging an incident that just happened can submit immediately.
  const [incidentTime, setIncidentTime] = useState<string>(() => nowAsLocalDatetimeInput());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0) {
      setError(t('form.errors.titleRequired'));
      return;
    }
    if (!incidentTime) {
      setError(t('form.errors.timeRequired'));
      return;
    }
    // Mirrors the backend @PastOrPresent check so the user gets immediate feedback.
    if (new Date(incidentTime).getTime() > Date.now()) {
      setError(t('form.errors.futureTime'));
      return;
    }
    setLoading(true);
    try {
      await incidentsApi.create({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        // Append ":00" so the backend receives a fully-qualified ISO LocalDateTime.
        incidentTime: `${incidentTime}:00`,
        location: location.trim() || undefined,
      });
      navigate('/my-incidents', { replace: true });
    } catch {
      setError(t('form.errors.save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4 }, mb: 4 }}>
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" gutterBottom>{t('form.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('form.subtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              id="title"
              label={t('form.shortTitle')}
              placeholder={t('form.shortTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 140 }}
              required
              fullWidth
            />

            <TextField
              id="description"
              label={t('form.description')}
              placeholder={t('form.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: 4000 }}
              fullWidth
            />

            <TextField
              id="incident-time"
              label={t('form.when')}
              type="datetime-local"
              value={incidentTime}
              onChange={(e) => setIncidentTime(e.target.value)}
              // Cap the picker at "now" — the backend also enforces @PastOrPresent.
              inputProps={{ max: nowAsLocalDatetimeInput() }}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />

            <TextField
              id="location"
              label={t('form.where')}
              placeholder={t('form.wherePlaceholder')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />

            <TextField
              id="category"
              select
              label={t('form.category')}
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              fullWidth
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{t(`form.categoryOption.${c}`)}</MenuItem>
              ))}
            </TextField>

            <TextField
              id="severity"
              select
              label={t('form.urgency')}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              fullWidth
            >
              {SEVERITIES.map((s) => (
                <MenuItem key={s} value={s}>{t(`form.severityOption.${s}`)}</MenuItem>
              ))}
            </TextField>

            {/* column-reverse on phones keeps the primary "Submit" on top (thumb-
                reachable) while stacking Cancel below it; row on sm+ as before. */}
            <Stack
              direction={{ xs: 'column-reverse', sm: 'row' }}
              spacing={2}
              justifyContent="flex-end"
            >
              <Button type="button" onClick={() => navigate(-1)} disabled={loading}>{t('form.cancel')}</Button>
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? t('form.submitting') : t('form.submit')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
