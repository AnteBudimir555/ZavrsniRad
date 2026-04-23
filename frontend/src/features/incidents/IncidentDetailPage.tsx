// WHY THIS FILE EXISTS
// --------------------
// Read-only view of a single incident. Used when a row in the list is clicked
// (not wired up by default — add an onRowClick to the DataGrid if you want it).

import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { Incident, incidentsApi } from '../../api/incidents';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    incidentsApi.get(Number(id))
      .then(setIncident)
      .catch(() => setError('Could not load this incident.'));
  }, [id]);

  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!incident) return <Container sx={{ mt: 4 }}><Typography>Loading…</Typography></Container>;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{incident.title}</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={incident.category} />
            <Chip label={incident.severity} />
            <Chip label={incident.status.replace('_', ' ')} color="primary" />
          </Stack>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {incident.description || <em>No description provided.</em>}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Reported by {incident.reporterUsername} on {new Date(incident.createdAt).toLocaleString()}
            {incident.resolvedAt && <> · Resolved on {new Date(incident.resolvedAt).toLocaleString()}</>}
          </Typography>
          <Button component={RouterLink} to="/" variant="text" sx={{ alignSelf: 'flex-start' }}>
            ← Back to list
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
