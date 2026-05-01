// WHY THIS FILE EXISTS
// --------------------
// Full detail view of a single incident: metadata, admin assign action,
// collapsible audit history (admin-only), and a comments thread visible
// to both the reporter and admins.

import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../../auth/AuthContext';
import { AuditLog, Comment, Incident, incidentsApi } from '../../api/incidents';
import { usersApi } from '../../api/users';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const incidentId = Number(id);

  const [incident, setIncident] = useState<Incident | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<string[]>([]);

  const loadAll = async () => {
    try {
      const [inc, coms] = await Promise.all([
        incidentsApi.get(incidentId),
        incidentsApi.listComments(incidentId),
      ]);
      setIncident(inc);
      setComments(coms);
      if (isAdmin) {
        const logs = await incidentsApi.listAudit(incidentId);
        setAuditLogs(logs);
      }
    } catch {
      setError('Could not load this incident.');
    }
  };

  useEffect(() => {
    if (!id) return;
    void loadAll();
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    usersApi.listAll()
      .then(users => setUserOptions(users.map(u => u.username)))
      .catch(() => {});
  }, [isAdmin]);

  const refreshAudit = async () => {
    if (!isAdmin) return;
    const logs = await incidentsApi.listAudit(incidentId);
    setAuditLogs(logs);
  };

  const handleAssign = async () => {
    setAssignError(null);
    try {
      const updated = await incidentsApi.assign(incidentId, assigneeInput.trim() || null);
      setIncident(updated);
      await refreshAudit();
      setAssignOpen(false);
      setAssigneeInput('');
    } catch {
      setAssignError('Could not assign incident. Check the username and try again.');
    }
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setCommentError(null);
    try {
      await incidentsApi.addComment(incidentId, commentBody.trim());
      setCommentBody('');
      const coms = await incidentsApi.listComments(incidentId);
      setComments(coms);
      await refreshAudit();
    } catch {
      setCommentError('Could not post comment.');
    }
  };

  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!incident) return <Container sx={{ mt: 4 }}><Typography>Loading…</Typography></Container>;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>

        {/* ── Main incident card ── */}
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5">{incident.title}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={incident.category} />
              <Chip label={incident.severity} />
              <Chip label={incident.status.replace('_', ' ')} color="primary" />
            </Stack>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {incident.description || <em>No description provided.</em>}
            </Typography>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Occurred:</strong> {new Date(incident.incidentTime).toLocaleString()}
              </Typography>
              {incident.location && (
                <Typography variant="body2">
                  <strong>Location:</strong> {incident.location}
                </Typography>
              )}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2">
                  <strong>Assigned to:</strong> {incident.assignedToUsername ?? 'Unassigned'}
                </Typography>
                {isAdmin && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setAssigneeInput(incident.assignedToUsername ?? '');
                      setAssignError(null);
                      setAssignOpen(true);
                    }}
                  >
                    Assign…
                  </Button>
                )}
              </Stack>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Reported by {incident.reporterUsername} on {new Date(incident.createdAt).toLocaleString()}
              {incident.resolvedAt && (
                <> · Resolved on {new Date(incident.resolvedAt).toLocaleString()}</>
              )}
            </Typography>

            <Button component={RouterLink} to="/" variant="text" sx={{ alignSelf: 'flex-start' }}>
              ← Back to list
            </Button>
          </Stack>
        </Paper>

        {/* ── Audit history — admin only ── */}
        {isAdmin && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="medium">History ({auditLogs.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {auditLogs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No audit entries yet.</Typography>
              ) : (
                <Stack spacing={1} divider={<Divider />}>
                  {auditLogs.map(log => (
                    <Stack key={log.id} direction="row" spacing={2} alignItems="baseline">
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.occurredAt).toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{log.actorUsername}</strong> — {log.action.replace(/_/g, ' ')}
                        {log.detail ? `: ${log.detail}` : ''}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* ── Comments ── */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" mb={2}>Comments</Typography>

          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" mb={2}>
              No comments yet.
            </Typography>
          ) : (
            <Stack spacing={2} mb={3} divider={<Divider />}>
              {comments.map(c => (
                <Box key={c.id}>
                  <Stack direction="row" spacing={1} alignItems="baseline" mb={0.5}>
                    <Typography variant="subtitle2">{c.authorUsername}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(c.createdAt).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.body}</Typography>
                </Box>
              ))}
            </Stack>
          )}

          {commentError && <Alert severity="error" sx={{ mb: 1 }}>{commentError}</Alert>}

          <Stack spacing={1}>
            <TextField
              multiline
              minRows={2}
              label="Add a comment"
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              inputProps={{ maxLength: 2000 }}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleAddComment}
              disabled={!commentBody.trim()}
              sx={{ alignSelf: 'flex-end' }}
            >
              Post
            </Button>
          </Stack>
        </Paper>
      </Stack>

      {/* ── Assign dialog ── */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Incident</DialogTitle>
        <DialogContent>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
          <Autocomplete
            options={userOptions}
            value={assigneeInput || null}
            onChange={(_, newValue) => setAssigneeInput(newValue ?? '')}
            renderInput={params => (
              <TextField
                {...params}
                autoFocus
                margin="dense"
                label="Assignee (clear to unassign)"
                fullWidth
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button onClick={handleAssign} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
