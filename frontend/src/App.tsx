// WHY THIS FILE EXISTS
// --------------------
// Top-level app shell: app bar (logo, logout) + the route table.
// Admin users land on the "all incidents" list; reporters land on "my incidents".
// ProtectedRoute makes sure unauthenticated users are bounced to /login.

import { AppBar, Box, Button, IconButton, Toolbar, Typography } from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { Navigate, Route, Routes, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import IncidentListPage from './features/incidents/IncidentListPage';
import IncidentFormPage from './features/incidents/IncidentFormPage';
import IncidentDetailPage from './features/incidents/IncidentDetailPage';

function TopBar() {
  const { isAuthenticated, isAdmin, username, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <IconButton edge="start" color="inherit" sx={{ mr: 1 }} disabled>
          <ReportProblemIcon />
        </IconButton>
        <Typography variant="h6" component={RouterLink} to="/"
                    sx={{ color: 'inherit', textDecoration: 'none', flexGrow: 1 }}>
          Incident Management
        </Typography>
        {isAuthenticated ? (
          <>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {username} ({isAdmin ? 'admin' : 'reporter'})
            </Typography>
            <Button color="inherit" onClick={() => { logout(); navigate('/login'); }}>
              Sign out
            </Button>
          </>
        ) : (
          <Button color="inherit" component={RouterLink} to="/login">Sign in</Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default function App() {
  const { isAdmin } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              {isAdmin ? <IncidentListPage scope="all" /> : <IncidentListPage scope="mine" />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-incidents"
          element={<ProtectedRoute><IncidentListPage scope="mine" /></ProtectedRoute>}
        />
        <Route
          path="/incidents/new"
          element={<ProtectedRoute><IncidentFormPage /></ProtectedRoute>}
        />
        <Route
          path="/incidents/:id"
          element={<ProtectedRoute><IncidentDetailPage /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}
