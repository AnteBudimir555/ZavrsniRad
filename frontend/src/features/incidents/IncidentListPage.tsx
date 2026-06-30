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
  InputLabel, MenuItem, Pagination, Select, Skeleton, Stack, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { enUS, hrHR } from '@mui/x-data-grid/locales';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { IncidentCard } from '../../components/IncidentCard';
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  // Localise the DataGrid's own chrome (footer "Rows per page", filter panel, etc.)
  // by pulling the matching MUI X locale bundle and following the active language.
  const dataGridLocaleText =
    (i18n.resolvedLanguage === 'hr' ? hrHR : enUS)
      .components.MuiDataGrid.defaultProps.localeText;
  // Below sm we swap the wide DataGrid for a vertical list of cards.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
        if (active) setError(t('incidents.errors.load'));
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
      setError(t('incidents.errors.export'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await incidentsApi.updateStatus(id, 'RESOLVED');
      setRefreshKey(k => k + 1);
    } catch {
      setError(t('incidents.errors.status'));
    }
  };

  const columns: GridColDef<Incident>[] = [
    { field: 'id', headerName: t('incidents.col.id'), width: 80 },
    { field: 'title', headerName: t('incidents.col.title'), flex: 1, minWidth: 220 },
    {
      field: 'category',
      headerName: t('incidents.col.category'),
      width: 130,
      renderCell: (p: GridRenderCellParams<Incident>) => t(`incidents.category.${p.value as IncidentCategory}`),
    },
    {
      field: 'severity',
      headerName: t('incidents.col.severity'),
      width: 130,
      renderCell: (p: GridRenderCellParams<Incident>) => (
        <Chip size="small" label={t(`incidents.severity.${p.value as IncidentSeverity}`)}
              color={severityColor[p.value as string] ?? 'default'} />
      ),
    },
    {
      field: 'status',
      headerName: t('incidents.col.status'),
      width: 140,
      renderCell: (p: GridRenderCellParams<Incident>) => (
        <Chip size="small" label={t(`incidents.status.${p.value as IncidentStatus}`)}
              color={statusColor[p.value as IncidentStatus]} />
      ),
    },
    { field: 'reporterUsername', headerName: t('incidents.col.reporter'), width: 140 },
    { field: 'assignedToUsername', headerName: t('incidents.col.assignedTo'), width: 140,
      valueFormatter: (v: string | null) => v ?? '—' },
    {
      field: 'incidentTime',
      headerName: t('incidents.col.occurred'),
      width: 170,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleString() : ''),
    },
    { field: 'location', headerName: t('incidents.col.location'), width: 160,
      valueFormatter: (v: string | null) => v ?? '—' },
    {
      field: 'createdAt',
      headerName: t('incidents.col.reported'),
      width: 170,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleString() : ''),
    },
  ];

  // Admin sees a Resolve action column.
  if (scope === 'all' && isAdmin) {
    columns.push({
      field: 'actions',
      headerName: t('incidents.col.actions'),
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (p: GridRenderCellParams<Incident>) =>
        p.row.status !== 'RESOLVED' ? (
          <Button size="small" variant="outlined" onClick={() => handleResolve(p.row.id)}>
            {t('incidents.resolve')}
          </Button>
        ) : null,
    });
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        mb={2}
      >
        <Typography variant="h5">
          {t(`incidents.title.${scope}`)}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {scope === 'all' && isAdmin && (
            <Button variant="outlined" onClick={handleExport} disabled={exportLoading}>
              {exportLoading ? t('incidents.exporting') : t('incidents.exportCsv')}
            </Button>
          )}
          <Button component={RouterLink} to="/incidents/new" variant="contained">{t('incidents.report')}</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
          <InputLabel>{t('incidents.filter.status')}</InputLabel>
          <Select
            label={t('incidents.filter.status')}
            value={filters.status ?? ''}
            onChange={e => setFilters(f => ({ ...f, status: (e.target.value as IncidentStatus) || undefined }))}
          >
            <MenuItem value="">{t('incidents.filter.all')}</MenuItem>
            <MenuItem value="OPEN">{t('incidents.status.OPEN')}</MenuItem>
            <MenuItem value="IN_PROGRESS">{t('incidents.status.IN_PROGRESS')}</MenuItem>
            <MenuItem value="RESOLVED">{t('incidents.status.RESOLVED')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
          <InputLabel>{t('incidents.filter.category')}</InputLabel>
          <Select
            label={t('incidents.filter.category')}
            value={filters.category ?? ''}
            onChange={e => setFilters(f => ({ ...f, category: (e.target.value as IncidentCategory) || undefined }))}
          >
            <MenuItem value="">{t('incidents.filter.all')}</MenuItem>
            <MenuItem value="SAFETY">{t('incidents.category.SAFETY')}</MenuItem>
            <MenuItem value="IT">{t('incidents.category.IT')}</MenuItem>
            <MenuItem value="FACILITY">{t('incidents.category.FACILITY')}</MenuItem>
            <MenuItem value="OTHER">{t('incidents.category.OTHER')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
          <InputLabel>{t('incidents.filter.severity')}</InputLabel>
          <Select
            label={t('incidents.filter.severity')}
            value={filters.severity ?? ''}
            onChange={e => setFilters(f => ({ ...f, severity: (e.target.value as IncidentSeverity) || undefined }))}
          >
            <MenuItem value="">{t('incidents.filter.all')}</MenuItem>
            <MenuItem value="LOW">{t('incidents.severity.LOW')}</MenuItem>
            <MenuItem value="MEDIUM">{t('incidents.severity.MEDIUM')}</MenuItem>
            <MenuItem value="HIGH">{t('incidents.severity.HIGH')}</MenuItem>
            <MenuItem value="CRITICAL">{t('incidents.severity.CRITICAL')}</MenuItem>
          </Select>
        </FormControl>

        {(filters.status || filters.category || filters.severity) && (
          <Button variant="text" size="small" onClick={() => setFilters({})}>{t('incidents.filter.clear')}</Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isMobile ? (
        // ── Mobile: vertical card list + simple pager ──
        <Stack spacing={2}>
          {loading ? (
            // Placeholder cards so the layout doesn't jump while loading.
            [0, 1, 2, 3].map(i => (
              <Skeleton key={i} variant="rounded" height={150} />
            ))
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {t('incidents.noIncidents')}
            </Typography>
          ) : (
            <>
              {rows.map(incident => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onResolve={scope === 'all' && isAdmin ? handleResolve : undefined}
                />
              ))}
              {rowCount > paginationModel.pageSize && (
                <Stack alignItems="center" sx={{ mt: 1 }}>
                  <Pagination
                    count={Math.ceil(rowCount / paginationModel.pageSize)}
                    page={paginationModel.page + 1}
                    onChange={(_, page) =>
                      setPaginationModel(prev => ({ ...prev, page: page - 1 }))}
                    color="primary"
                  />
                </Stack>
              )}
            </>
          )}
        </Stack>
      ) : (
        // ── Desktop / tablet: the original DataGrid ──
        <Box sx={{ height: 560, bgcolor: 'background.paper' }}>
          <DataGrid
            rows={rows}
            rowCount={rowCount}
            columns={columns}
            localeText={dataGridLocaleText}
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
      )}
    </Container>
  );
}
