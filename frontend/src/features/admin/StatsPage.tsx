import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Button, Card, CardContent,
  Container, Grid, Skeleton, Stack, Typography,
} from '@mui/material';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { statsApi, StatsResponse } from '../../api/stats';

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#2196f3',
  IN_PROGRESS: '#ff9800',
  RESOLVED: '#4caf50',
};
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#8bc34a',
  MEDIUM: '#ff9800',
  HIGH: '#f44336',
  CRITICAL: '#9c27b0',
};

function toChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
        <Typography variant="h4" fontWeight="bold" color={color ?? 'text.primary'}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title, data, colorMap, defaultColor = '#5c6bc0',
}: {
  title: string;
  data: { name: string; value: number }[];
  colorMap?: Record<string, string>;
  defaultColor?: string;
}) {
  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="medium" mb={1}>{title}</Typography>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorMap?.[entry.name] ?? defaultColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statsApi.get()
      .then(setStats)
      .catch(() => setError('Could not load statistics.'));
  }, []);

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={2} mb={4}>
          {[0, 1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card elevation={2}>
                <CardContent>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height={56} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={3}>
          {[0, 1, 2].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Card elevation={2}>
                <CardContent>
                  <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5">Stats Dashboard</Typography>
        <Button component={RouterLink} to="/" variant="outlined">Back to Incidents</Button>
      </Stack>

      {/* Summary cards */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Total incidents" value={stats.total} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Open" value={stats.byStatus['OPEN'] ?? 0} color={STATUS_COLORS.OPEN} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="In Progress" value={stats.byStatus['IN_PROGRESS'] ?? 0} color={STATUS_COLORS.IN_PROGRESS} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Resolved" value={stats.byStatus['RESOLVED'] ?? 0} color={STATUS_COLORS.RESOLVED} />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ChartCard title="By Status" data={toChartData(stats.byStatus)} colorMap={STATUS_COLORS} />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="By Category" data={toChartData(stats.byCategory)} />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="By Severity" data={toChartData(stats.bySeverity)} colorMap={SEVERITY_COLORS} />
        </Grid>
      </Grid>
    </Container>
  );
}
