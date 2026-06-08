// WHY THIS FILE EXISTS
// --------------------
// Admin-only screen at /admin/users. Lists every account in the system and
// lets the admin toggle the 'active' flag. A deactivated user is blocked
// from signing in by AppUserDetailsService — the frontend just exposes the
// switch.
//
// Two UI guard rails:
//   - the row for the current admin shows a disabled "—" instead of a
//     toggle, so they can't lock themselves out (the backend enforces this
//     too via UserService.setActive).
//   - confirmation dialog before any state change, since deactivation has
//     immediate and (for the affected user) opaque consequences.

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useAuth } from '../../auth/AuthContext';
import { UserSummary, usersApi } from '../../api/users';

export default function UserManagementPage() {
  const { isAdmin, username } = useAuth();
  const theme = useTheme();
  // Below sm the user table becomes a vertical list of cards.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<UserSummary | null>(null);
  const [working, setWorking] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await usersApi.listAll());
    } catch {
      setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  // Guard rendered route — should never happen if App.tsx is wired correctly,
  // but cheap belt-and-braces for direct URL navigation.
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleConfirmToggle = async () => {
    if (!pendingTarget) return;
    setWorking(true);
    try {
      const updated = await usersApi.setActive(pendingTarget.id, !pendingTarget.active);
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
      setPendingTarget(null);
    } catch {
      setError('Could not update user. You cannot deactivate your own account.');
      setPendingTarget(null);
    } finally {
      setWorking(false);
    }
  };

  const columns: GridColDef<UserSummary>[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'username', headerName: 'Username', flex: 1, minWidth: 180 },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (p: GridRenderCellParams<UserSummary>) => (
        <Chip
          size="small"
          label={p.value as string}
          color={p.value === 'ADMIN' ? 'primary' : 'default'}
        />
      ),
    },
    {
      field: 'active',
      headerName: 'Status',
      width: 130,
      renderCell: (p: GridRenderCellParams<UserSummary, boolean>) => (
        <Chip
          size="small"
          label={p.value ? 'Active' : 'Inactive'}
          color={p.value ? 'success' : 'default'}
          variant={p.value ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleString() : ''),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (p: GridRenderCellParams<UserSummary>) => {
        const isSelf = p.row.username === username;
        if (isSelf) {
          return <Typography variant="caption" color="text.secondary">— self —</Typography>;
        }
        return (
          <Button
            size="small"
            variant="outlined"
            color={p.row.active ? 'warning' : 'success'}
            onClick={() => setPendingTarget(p.row)}
          >
            {p.row.active ? 'Deactivate' : 'Activate'}
          </Button>
        );
      },
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5">User management</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {isMobile ? (
        // ── Mobile: one card per user ──
        <Stack spacing={2}>
          {loading ? (
            [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={120} />)
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No users found.
            </Typography>
          ) : (
            rows.map(user => {
              const isSelf = user.username === username;
              return (
                <Card key={user.id} elevation={1}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
                          {user.username}
                        </Typography>
                        <Chip
                          size="small"
                          label={user.role}
                          color={user.role === 'ADMIN' ? 'primary' : 'default'}
                        />
                        <Chip
                          size="small"
                          label={user.active ? 'Active' : 'Inactive'}
                          color={user.active ? 'success' : 'default'}
                          variant={user.active ? 'filled' : 'outlined'}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Created: {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                      </Typography>
                      {isSelf ? (
                        <Typography variant="caption" color="text.secondary">— your account —</Typography>
                      ) : (
                        <Button
                          fullWidth
                          variant="outlined"
                          color={user.active ? 'warning' : 'success'}
                          onClick={() => setPendingTarget(user)}
                        >
                          {user.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      ) : (
        <Box sx={{ height: 560, bgcolor: 'background.paper' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      )}

      <Dialog open={!!pendingTarget} onClose={() => !working && setPendingTarget(null)} fullScreen={isMobile}>
        <DialogTitle>
          {pendingTarget?.active ? 'Deactivate' : 'Activate'} user
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingTarget?.active
              ? `User "${pendingTarget?.username}" will no longer be able to sign in. Existing JWTs remain valid until they expire.`
              : `User "${pendingTarget?.username}" will be able to sign in again.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={working} onClick={() => setPendingTarget(null)}>Cancel</Button>
          <Button
            disabled={working}
            variant="contained"
            color={pendingTarget?.active ? 'warning' : 'success'}
            onClick={handleConfirmToggle}
          >
            {pendingTarget?.active ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
