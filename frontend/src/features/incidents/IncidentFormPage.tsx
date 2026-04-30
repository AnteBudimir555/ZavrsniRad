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
import { incidentsApi, IncidentCategory, IncidentSeverity } from '../../api/incidents';

const CATEGORIES: IncidentCategory[] = ['SAFETY', 'IT', 'FACILITY', 'OTHER'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const categoryLabel: Record<IncidentCategory, string> = {
  SAFETY: 'Safety (injury, hazard, near-miss)',
  IT: 'IT (system, hardware, login issue)',
  FACILITY: 'Facility (building, equipment)',
  OTHER: 'Other',
};
const severityLabel: Record<IncidentSeverity, string> = {
  LOW: 'Low — nuisance, no urgent risk',
  MEDIUM: 'Medium — disruptive, needs attention',
  HIGH: 'High — significant impact or risk',
  CRITICAL: 'Critical — unsafe / blocking work right now',
};

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time (no zone, no seconds).
function nowAsLocalDatetimeInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function IncidentFormPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      setError('Please give the incident a short title.');
      return;
    }
    if (!incidentTime) {
      setError('Please pick when the incident happened.');
      return;
    }
    // Mirrors the backend @PastOrPresent check so the user gets immediate feedback.
    if (new Date(incidentTime).getTime() > Date.now()) {
      setError('The incident time cannot be in the future.');
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
      });
      navigate('/my-incidents', { replace: true });
    } catch {
      setError('Could not save. Please try again, or contact an administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Report an incident</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          A short description is enough — someone will follow up with you if we need more detail.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Short title"
              placeholder="e.g. Slippery floor near reception"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 140 }}
              required
              fullWidth
            />

            <TextField
              label="What happened? (optional)"
              placeholder="Describe what you saw, where, and approximately when."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: 4000 }}
              fullWidth
            />

            <TextField
              label="When did it happen?"
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
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              fullWidth
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{categoryLabel[c]}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="How urgent?"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              fullWidth
            >
              {SEVERITIES.map((s) => (
                <MenuItem key={s} value={s}>{severityLabel[s]}</MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button type="button" onClick={() => navigate(-1)} disabled={loading}>Cancel</Button>
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? 'Saving…' : 'Submit report'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
