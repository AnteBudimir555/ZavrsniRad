// WHY THIS FILE EXISTS
// --------------------
// On phones the AppBar can't fit the nav buttons + username + sign-out in one
// row, so below `sm` they collapse into a hamburger that opens THIS drawer.
// It mirrors exactly the links TopBar shows on desktop, driven by the same
// role logic (useAuth), so mobile and desktop never drift apart.
//
// The drawer is `temporary` (slides over the content, dims the rest) — the
// standard mobile pattern. Every item calls `onClose` so the drawer dismisses
// itself as soon as you navigate, which feels native.

import {
  Box, Divider, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

export function MobileNavDrawer({ open, onClose }: Props) {
  const { isAdmin, username, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Same destinations as the desktop TopBar, chosen by role. "Assigned to me"
  // is an admin destination — incidents get assigned to admins, who handle
  // them; reporters only report and track their own incidents.
  const navItems: NavItem[] = isAdmin
    ? [
        { label: t('nav.assigned'), to: '/assigned', icon: <AssignmentIndIcon /> },
        { label: t('nav.stats'), to: '/admin/stats', icon: <BarChartIcon /> },
        { label: t('nav.users'), to: '/admin/users', icon: <PeopleIcon /> },
      ]
    : [
        { label: t('nav.myReports'), to: '/', icon: <ListAltIcon /> },
      ];

  const handleSignOut = () => {
    onClose();
    logout();
    navigate('/login');
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 260 }} role="presentation">
        {/* Identity header — replaces the "username (role)" text from the bar. */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>{t('common.appName')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('nav.userBadge', {
              username,
              role: t(isAdmin ? 'roles.admin' : 'roles.reporter'),
            })}
          </Typography>
        </Box>
        <Divider />

        <List>
          {navItems.map(item => (
            <ListItemButton key={item.to} component={RouterLink} to={item.to} onClick={onClose}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider />

        <List>
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary={t('common.signOut')} />
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  );
}
