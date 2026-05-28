// WHY THIS FILE EXISTS
// --------------------
// Lists incidents. Two modes in one component, driven by the `scope` prop:
//   - scope="mine" → calls /incidents/mine (reporter's view)
//   - scope="all"  → calls /incidents      (admin's view, adds Resolve action)
// The MUI DataGrid gives us sorting, pagination, and column resizing for free.

import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Container, FormControl,
  InputLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useAuth } from '../../auth/AuthContext';
import {
  Incident, IncidentCategory, IncidentFilters, incidentsApi,
  IncidentSeverity, IncidentStatus,
} from '../../api/incidents';

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
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [filters, setFilters] = useState<IncidentFilters>({});
  // Incrementing this triggers a re-fetch without changing the page number (used after Resolve).
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);

  // Reset to page 0 whenever the user switches tabs or changes a filter.
  useEffect(() => {
    setPaginationModel(prev => prev.page !== 0 ? { ...prev, page: 0 } : prev);
  }, [scope, filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const { page, pageSize } = paginationModel;

    (async () => {
      try {
        const data =
          scope === 'all'      ? await incidentsApi.listAll(page, pageSize, filters) :
          scope === 'assigned' ? await incidentsApi.listAssigned(page, pageSize, filters) :
                                 await incidentsApi.listMine(page, pageSize, filters);
        if (active) {
          setRows(data.content);
          setRowCount(data.totalElements);
        }
      } catch {
        if (active) setError('Could not load incidents. Check your connection or sign in again.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [scope, paginationModel, filters, refreshKey]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await incidentsApi.exportCsv(filters);
    } catch {
      setError('Could not export incidents.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await incidentsApi.updateStatus(id, 'RESOLVED');
      setRefreshKey(k => k + 1);
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
        <Stack direction="row" spacing={1}>
          {scope === 'all' && isAdmin && (
            <Button variant="outlined" onClick={handleExport} disabled={exportLoading}>
              {exportLoading ? 'Exporting…' : 'Export CSV'}
            </Button>
          )}
          <Button component={RouterLink} to="/incidents/new" variant="contained">Report incident</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={filters.status ?? ''}
            onChange={e => setFilters(f => ({ ...f, status: (e.target.value as IncidentStatus) || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="OPEN">Open</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="RESOLVED">Resolved</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Category</InputLabel>
          <Select
            label="Category"
            value={filters.category ?? ''}
            onChange={e => setFilters(f => ({ ...f, category: (e.target.value as IncidentCategory) || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="SAFETY">Safety</MenuItem>
            <MenuItem value="IT">IT</MenuItem>
            <MenuItem value="FACILITY">Facility</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            label="Severity"
            value={filters.severity ?? ''}
            onChange={e => setFilters(f => ({ ...f, severity: (e.target.value as IncidentSeverity) || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="CRITICAL">Critical</MenuItem>
          </Select>
        </FormControl>

        {(filters.status || filters.category || filters.severity) && (
          <Button variant="text" size="small" onClick={() => setFilters({})}>Clear filters</Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ height: 560, bgcolor: 'background.paper' }}>
        <DataGrid
          rows={rows}
          rowCount={rowCount}
          columns={columns}
          loading={loading}
          onRowClick={p => navigate(`/incidents/${p.row.id}`)}
          sx={{ cursor: 'pointer' }}
          disableRowSelectionOnClick
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
        />
      </Box>
    </Container>
  );
}
