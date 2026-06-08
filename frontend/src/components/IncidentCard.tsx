// WHY THIS FILE EXISTS
// --------------------
// The DataGrid on the incident list is ~1400px wide — unusable on a phone
// without sideways scrolling. Below `sm` we render each incident as one of
// these cards instead: the whole card is a tap target that opens the detail
// page, and the admin's "Resolve" action becomes a full-width button.
//
// We keep the same status/severity chip colours as the grid so the two views
// look like the same app.

import {
  Button, Card, CardActionArea, CardActions, CardContent, Chip, Stack, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Incident, IncidentStatus } from '../api/incidents';

const statusColor: Record<IncidentStatus, 'default' | 'info' | 'success'> = {
  OPEN: 'info',
  IN_PROGRESS: 'default',
  RESOLVED: 'success',
};

const severityColor: Record<string, 'default' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'default',
  HIGH: 'warning',
  CRITICAL: 'error',
};

interface Props {
  incident: Incident;
  // Supplied only for the admin "all incidents" view; when present and the
  // incident isn't resolved yet, a full-width Resolve button is shown.
  onResolve?: (id: number) => void;
}

export function IncidentCard({ incident, onResolve }: Props) {
  return (
    <Card elevation={1}>
      <CardActionArea component={RouterLink} to={`/incidents/${incident.id}`}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              #{incident.id} · {incident.title}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={incident.category} />
              <Chip
                size="small"
                label={incident.severity}
                color={severityColor[incident.severity] ?? 'default'}
              />
              <Chip
                size="small"
                label={incident.status.replace('_', ' ')}
                color={statusColor[incident.status]}
              />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Reporter: {incident.reporterUsername}
              {incident.assignedToUsername ? ` · Assigned: ${incident.assignedToUsername}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Occurred: {new Date(incident.incidentTime).toLocaleString()}
            </Typography>
            {incident.location && (
              <Typography variant="body2" color="text.secondary">
                Location: {incident.location}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>

      {onResolve && incident.status !== 'RESOLVED' && (
        <CardActions>
          <Button fullWidth variant="outlined" onClick={() => onResolve(incident.id)}>
            Resolve
          </Button>
        </CardActions>
      )}
    </Card>
  );
}
