// WHY THIS FILE EXISTS
// --------------------
// Top-level app shell: app bar (logo, logout) + the route table.
// Admin users land on the "all incidents" list; reporters land on "my incidents".
// ProtectedRoute makes sure unauthenticated users are bounced to /login.

import { lazy, Suspense, useState } from 'react';
import {
  AppBar, Box, Button, CircularProgress, IconButton, Toolbar, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import MenuIcon from '@mui/icons-material/Menu';
import { Navigate, Route, Routes, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { MobileNavDrawer } from './components/MobileNavDrawer';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { SessionExpiredDialog } from './auth/SessionExpiredDialog';

// Route components are lazy-loaded so the first paint downloads only the code
// for the page you land on. Big libraries get isolated automatically: recharts
// rides along only with StatsPage, and the DataGrid only with the list pages —
// the login screen no longer pays to download either.
const LoginPage = lazy(() => import('./auth/LoginPage'));
const RegisterPage = lazy(() => import('./auth/RegisterPage'));
const IncidentListPage = lazy(() => import('./features/incidents/IncidentListPage'));
const IncidentFormPage = lazy(() => import('./features/incidents/IncidentFormPage'));
const IncidentDetailPage = lazy(() => import('./features/incidents/IncidentDetailPage'));
const UserManagementPage = lazy(() => import('./features/admin/UserManagementPage'));
const StatsPage = lazy(() => import('./features/admin/StatsPage'));

function TopBar() {
  const { isAuthenticated, isAdmin, username, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  // "mobile" = below the sm breakpoint (600px). Below this the inline nav
  // buttons don't fit, so we swap them for a hamburger + drawer.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);

  // On mobile when signed in: a hamburger that opens the drawer.
  // Otherwise: the (decorative, disabled) app icon as before.
  const showHamburger = isAuthenticated && isMobile;

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        {showHamburger ? (
          <IconButton
            edge="start"
            color="inherit"
            sx={{ mr: 1 }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon />
          </IconButton>
        ) : (
          <IconButton edge="start" color="inherit" sx={{ mr: 1 }} disabled>
            <ReportProblemIcon />
          </IconButton>
        )}
        <Typography variant="h6" component={RouterLink} to="/"
                    sx={{ color: 'inherit', textDecoration: 'none', flexGrow: 1 }}>
          Incident Management
        </Typography>
        {isAuthenticated ? (
          // On mobile the links live in the drawer, so the bar's right side is
          // empty. On sm+ we keep the original inline buttons + username.
          isMobile ? null : (
            <>
              {!isAdmin && (
                <>
                  <Button color="inherit" component={RouterLink} to="/">My Reports</Button>
                  <Button color="inherit" component={RouterLink} to="/assigned">Assigned to Me</Button>
                </>
              )}
              {isAdmin && (
                <>
                  <Button color="inherit" component={RouterLink} to="/admin/stats">Stats</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/users">Users</Button>
                </>
              )}
              <Typography variant="body2" sx={{ mx: 2 }}>
                {username} ({isAdmin ? 'admin' : 'reporter'})
              </Typography>
              <Button color="inherit" onClick={() => { logout(); navigate('/login'); }}>
                Sign out
              </Button>
            </>
          )
        ) : (
          <Button color="inherit" component={RouterLink} to="/login">Sign in</Button>
        )}
      </Toolbar>
      {isAuthenticated && (
        <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      )}
    </AppBar>
  );
}

export default function App() {
  const { isAdmin } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />
      <SessionExpiredDialog />
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        }
      >
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
          path="/assigned"
          element={<ProtectedRoute><IncidentListPage scope="assigned" /></ProtectedRoute>}
        />
        <Route
          path="/incidents/new"
          element={<ProtectedRoute><IncidentFormPage /></ProtectedRoute>}
        />
        <Route
          path="/incidents/:id"
          element={<ProtectedRoute><IncidentDetailPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/users"
          element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/stats"
          element={<ProtectedRoute><StatsPage /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Box>
  );
}
