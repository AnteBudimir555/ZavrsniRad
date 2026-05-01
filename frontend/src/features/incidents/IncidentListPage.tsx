// WHY THIS FILE EXISTS
// --------------------
// Lists incidents. Two modes in one component, driven by the `scope` prop:
//   - scope="mine" → calls /incidents/mine (reporter's view)
//   - scope="all"  → calls /incidents      (admin's view, adds Resolve action)
// The MUI DataGrid gives us sorting, pagination, and column resizing for free.

import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useAuth } from '../../auth/AuthContext';
import { Incident, incidentsApi, IncidentStatus } from '../../api/incidents';

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

interface Props { scope: 'mine' | 'all' | 'assigned' }

export default function IncidentListPage({ scope }: Props) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        scope === 'all' ? await incidentsApi.listAll() :
        scope === 'assigned' ? await incidentsApi.listAssigned() :
        await incidentsApi.listMine();
      setRows(data);
    } catch {
      setError('Could not load incidents. Check your connection or sign in again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [scope]);

  const handleResolve = async (id: number) => {
    try {
      await incidentsApi.updateStatus(id, 'RESOLVED');
      await reload();
    } catch {
      setError('Could not update status.');
    }
  };

  const columns: GridColDef<Incident>[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 220 },
    { field: 'category', headerName: 'Category', width: 130 },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 130,
      renderCell: (p: GridRenderCellParams<Incident>) => (
        <Chip size="small" label={p.value as string} color={severityColor[p.value as string] ?? 'default'} />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (p: GridRenderCellParams<Incident>) => (
        <Chip size="small" label={(p.value as string).replace('_', ' ')}
              color={statusColor[p.value as IncidentStatus]} />
      ),
    },
    { field: 'reporterUsername', headerName: 'Reporter', width: 140 },
    { field: 'assignedToUsername', headerName: 'Assigned to', width: 140,
      valueFormatter: (v: string | null) => v ?? '—' },
    {
      field: 'incidentTime',
      headerName: 'Occurred',
      width: 170,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleString() : ''),
    },
    { field: 'location', headerName: 'Location', width: 160,
      valueFormatter: (v: string | null) => v ?? '—' },
    {
      field: 'createdAt',
      headerName: 'Reported',
      width: 170,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleString() : ''),
    },
  ];

  // Admin sees a Resolve action column.
  if (scope === 'all' && isAdmin) {
    columns.push({
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (p: GridRenderCellParams<Incident>) =>
        p.row.status !== 'RESOLVED' ? (
          <Button size="small" variant="outlined" onClick={() => handleResolve(p.row.id)}>
            Resolve
          </Button>
        ) : null,
    });
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5">
          {scope === 'all' ? 'All incidents' : scope === 'assigned' ? 'Assigned to me' : 'My incidents'}
        </Typography>
        <Button component={RouterLink} to="/incidents/new" variant="contained">Report incident</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ height: 560, bgcolor: 'background.paper' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          onRowClick={p => navigate(`/incidents/${p.row.id}`)}
          sx={{ cursor: 'pointer' }}
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>
    </Container>
  );
}
