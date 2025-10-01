/**
 * Optimized MUI Imports
 * 
 * Centralized import configuration for Material-UI components.
 * This ensures consistent and optimized imports across the application.
 * 
 * Usage:
 * import { Button, TextField } from '@/lib/mui-optimized'
 */

// Core components - import only what's commonly used
export { default as Alert } from '@mui/material/Alert';
export { default as AlertTitle } from '@mui/material/AlertTitle';
export { default as AppBar } from '@mui/material/AppBar';
export { default as Autocomplete } from '@mui/material/Autocomplete';
export { default as Avatar } from '@mui/material/Avatar';
export { default as Backdrop } from '@mui/material/Backdrop';
export { default as Badge } from '@mui/material/Badge';
export { default as Box } from '@mui/material/Box';
export { default as Button } from '@mui/material/Button';
export { default as ButtonGroup } from '@mui/material/ButtonGroup';
export { default as Card } from '@mui/material/Card';
export { default as CardActions } from '@mui/material/CardActions';
export { default as CardContent } from '@mui/material/CardContent';
export { default as CardHeader } from '@mui/material/CardHeader';
export { default as Checkbox } from '@mui/material/Checkbox';
export { default as Chip } from '@mui/material/Chip';
export { default as CircularProgress } from '@mui/material/CircularProgress';
export { default as Collapse } from '@mui/material/Collapse';
export { default as Container } from '@mui/material/Container';
export { default as Dialog } from '@mui/material/Dialog';
export { default as DialogActions } from '@mui/material/DialogActions';
export { default as DialogContent } from '@mui/material/DialogContent';
export { default as DialogContentText } from '@mui/material/DialogContentText';
export { default as DialogTitle } from '@mui/material/DialogTitle';
export { default as Divider } from '@mui/material/Divider';
export { default as Drawer } from '@mui/material/Drawer';
export { default as Fab } from '@mui/material/Fab';
export { default as FormControl } from '@mui/material/FormControl';
export { default as FormControlLabel } from '@mui/material/FormControlLabel';
export { default as FormGroup } from '@mui/material/FormGroup';
export { default as FormHelperText } from '@mui/material/FormHelperText';
export { default as FormLabel } from '@mui/material/FormLabel';
export { default as Grid } from '@mui/material/Grid';
export { default as IconButton } from '@mui/material/IconButton';
export { default as InputAdornment } from '@mui/material/InputAdornment';
export { default as InputLabel } from '@mui/material/InputLabel';
export { default as LinearProgress } from '@mui/material/LinearProgress';
export { default as Link } from '@mui/material/Link';
export { default as List } from '@mui/material/List';
export { default as ListItem } from '@mui/material/ListItem';
export { default as ListItemButton } from '@mui/material/ListItemButton';
export { default as ListItemIcon } from '@mui/material/ListItemIcon';
export { default as ListItemSecondaryAction } from '@mui/material/ListItemSecondaryAction';
export { default as ListItemText } from '@mui/material/ListItemText';
export { default as Menu } from '@mui/material/Menu';
export { default as MenuItem } from '@mui/material/MenuItem';
export { default as Modal } from '@mui/material/Modal';
export { default as OutlinedInput } from '@mui/material/OutlinedInput';
export { default as Paper } from '@mui/material/Paper';
export { default as Popover } from '@mui/material/Popover';
export { default as Radio } from '@mui/material/Radio';
export { default as RadioGroup } from '@mui/material/RadioGroup';
export { default as Select } from '@mui/material/Select';
export { default as Skeleton } from '@mui/material/Skeleton';
export { default as Snackbar } from '@mui/material/Snackbar';
export { default as Stack } from '@mui/material/Stack';
export { default as Step } from '@mui/material/Step';
export { default as StepLabel } from '@mui/material/StepLabel';
export { default as Stepper } from '@mui/material/Stepper';
export { default as Switch } from '@mui/material/Switch';
export { default as Tab } from '@mui/material/Tab';
export { default as Table } from '@mui/material/Table';
export { default as TableBody } from '@mui/material/TableBody';
export { default as TableCell } from '@mui/material/TableCell';
export { default as TableContainer } from '@mui/material/TableContainer';
export { default as TableHead } from '@mui/material/TableHead';
export { default as TablePagination } from '@mui/material/TablePagination';
export { default as TableRow } from '@mui/material/TableRow';
export { default as Tabs } from '@mui/material/Tabs';
export { default as TextField } from '@mui/material/TextField';
export { default as Toolbar } from '@mui/material/Toolbar';
export { default as Tooltip } from '@mui/material/Tooltip';
export { default as Typography } from '@mui/material/Typography';

// Utilities and types
export { styled } from '@mui/material/styles';
export { useTheme } from '@mui/material/styles';
export { alpha } from '@mui/material/styles';

// Re-export types
export type {
  AlertColor,
  AlertProps,
  ButtonProps,
  TextFieldProps,
  SelectProps,
  CheckboxProps,
  DialogProps,
  IconButtonProps,
  MenuProps,
  PaperProps,
  TableProps,
  TypographyProps,
} from '@mui/material';

// Date pickers (if used)
export { DatePicker } from '@mui/x-date-pickers/DatePicker';
export { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
export { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Icons optimization helper
export function createIconImport(iconName: string) {
  // Dynamic import for icons to reduce initial bundle
  return import(`@mui/icons-material/${iconName}`);
}