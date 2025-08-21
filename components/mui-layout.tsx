'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListSubheader,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Description as InvoiceIcon,
  People as ClientsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Receipt as LUTIcon,
  Payment as PaymentIcon,
  Work as WorkIcon,
  Assignment as ReturnsIcon,
  Repeat as RecurringIcon,
  CreditCard as SubscriptionIcon,
  ShoppingCart as PurchasesIcon,
  Assessment as ITCIcon,
  NoteAdd as NotesIcon,
  AttachMoney as AdvanceIcon,
  SwapHoriz as RCMIcon,
} from '@mui/icons-material'
import { signOut } from 'next-auth/react'
import { useTheme as useAppTheme } from '@/components/theme-provider'

const drawerWidth = 280

interface MUILayoutProps {
  children: React.ReactNode
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { text: 'Invoices', icon: <InvoiceIcon />, href: '/invoices' },
  { text: 'Recurring Invoices', icon: <RecurringIcon />, href: '/recurring' },
  { text: 'Subscriptions', icon: <SubscriptionIcon />, href: '/subscriptions' },
  { text: 'Clients', icon: <ClientsIcon />, href: '/clients' },
  { text: 'Payments', icon: <PaymentIcon />, href: '/payments' },
  { text: 'Advance Receipts', icon: <AdvanceIcon />, href: '/advances' },
  { text: 'Purchase Invoices', icon: <PurchasesIcon />, href: '/purchases' },
  { text: 'RCM Management', icon: <RCMIcon />, href: '/rcm' },
  { text: 'ITC Management', icon: <ITCIcon />, href: '/itc' },
  { text: 'Credit/Debit Notes', icon: <NotesIcon />, href: '/notes' },
  { text: 'GST Returns', icon: <ReturnsIcon />, href: '/returns' },
  { text: 'LUT Management', icon: <LUTIcon />, href: '/luts' },
]

const bottomMenuItems = [
  { text: 'Settings', icon: <SettingsIcon />, href: '/settings' },
]

export function MUILayout({ children, user }: MUILayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { isDarkMode, toggleTheme } = useAppTheme()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleUserMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WorkIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" noWrap component="div" fontWeight={600}>
            GSTHive
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      
      <List sx={{ flex: 1, px: 2, py: 1 }}>
        <ListSubheader sx={{ background: 'transparent', fontWeight: 600, mb: 1 }}>
          Main Menu
        </ListSubheader>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => {
                router.push(item.href)
                if (isMobile) {
                  setMobileOpen(false)
                }
              }}
              selected={pathname === item.href}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />
      
      <List sx={{ px: 2, py: 1 }}>
        {bottomMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => {
                router.push(item.href)
                if (isMobile) {
                  setMobileOpen(false)
                }
              }}
              selected={pathname === item.href}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <IconButton onClick={toggleTheme} color="inherit" sx={{ mr: 2 }}>
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          
          <IconButton
            onClick={handleUserMenuOpen}
            sx={{ p: 0 }}
          >
            <Avatar 
              alt={user?.name || 'User'} 
              src={user?.image || undefined}
              sx={{ width: 40, height: 40 }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleUserMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {user?.name || 'User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email || ''}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => {
              router.push('/settings')
              handleUserMenuClose()
            }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleSignOut}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: 'none',
              boxShadow: theme.shadows[4],
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: 'none',
              boxShadow: theme.shadows[1],
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}