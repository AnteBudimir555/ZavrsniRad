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
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { AuditLog, Comment, Incident, incidentsApi } from '../../api/incidents';
import { usersApi } from '../../api/users';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const incidentId = Number(id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      setError(t('detail.errors.load'));
    }
  };

  useEffect(() => {
    if (!id) return;
    void loadAll();
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    // Only admins can act on an incident (change status, resolve), so an
    // incident is only ever assigned to an admin. Offer admins as the
    // assignee choices — assigning to a reporter would be a dead end since
    // reporters can't view or work incidents they didn't report.
    usersApi.listAll()
      .then(users => setUserOptions(users.filter(u => u.role === 'ADMIN').map(u => u.username)))
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
      setAssignError(t('detail.errors.assign'));
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
      setCommentError(t('detail.errors.comment'));
    }
  };

  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!incident) return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="60%" height={40} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={90} height={24} />
            <Skeleton variant="rounded" width={90} height={24} />
            <Skeleton variant="rounded" width={90} height={24} />
          </Stack>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="text" width="75%" />
          <Skeleton variant="text" width="30%" />
          <Divider />
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="55%" />
        </Stack>
      </Paper>
    </Container>
  );

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>

        {/* ── Main incident card ── */}
        <Paper sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={2}>
            <Typography variant="h5">{incident.title}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={t(`incidents.category.${incident.category}`)} />
              <Chip label={t(`incidents.severity.${incident.severity}`)} />
              <Chip label={t(`incidents.status.${incident.status}`)} color="primary" />
            </Stack>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {incident.description || <em>{t('detail.noDescription')}</em>}
            </Typography>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>{t('detail.occurred')}</strong> {new Date(incident.incidentTime).toLocaleString()}
              </Typography>
              {incident.location && (
                <Typography variant="body2">
                  <strong>{t('detail.location')}</strong> {incident.location}
                </Typography>
              )}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2">
                  <strong>{t('detail.assignedTo')}</strong> {incident.assignedToUsername ?? t('detail.unassigned')}
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
                    {t('detail.assign')}
                  </Button>
                )}
              </Stack>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              {t('detail.reportedBy', {
                user: incident.reporterUsername,
                date: new Date(incident.createdAt).toLocaleString(),
              })}
              {incident.resolvedAt &&
                t('detail.resolvedOn', { date: new Date(incident.resolvedAt).toLocaleString() })}
            </Typography>

            <Button component={RouterLink} to="/" variant="text" sx={{ alignSelf: 'flex-start' }}>
              {t('detail.backToList')}
            </Button>
          </Stack>
        </Paper>

        {/* ── Audit history — admin only ── */}
        {isAdmin && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="medium">{t('detail.history', { count: auditLogs.length })}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {auditLogs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('detail.noAuditEntries')}</Typography>
              ) : (
                <Stack spacing={1} divider={<Divider />}>
                  {auditLogs.map(log => (
                    <Stack key={log.id} direction="row" spacing={2} alignItems="baseline">
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.occurredAt).toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{log.actorUsername}</strong> — {t(`detail.action.${log.action}`)}
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
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" mb={2}>{t('detail.comments')}</Typography>

          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t('detail.noComments')}
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
              label={t('detail.addComment')}
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
              {t('detail.post')}
            </Button>
          </Stack>
        </Paper>
      </Stack>

      {/* ── Assign dialog ── */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('detail.assignDialogTitle')}</DialogTitle>
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
                label={t('detail.assignee')}
                fullWidth
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>{t('detail.cancel')}</Button>
          <Button onClick={handleAssign} variant="contained">{t('detail.save')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
