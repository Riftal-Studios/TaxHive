import { createTheme, alpha } from "@mui/material/styles";

// Use system fonts as fallback for environments where Google Fonts cannot be reached
const roboto = {
  style: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

declare module "@mui/material/styles" {
  interface Theme {
    status: {
      paid: string;
      sent: string;
      draft: string;
      overdue: string;
      partiallyPaid: string;
      viewed: string;
      cancelled: string;
    };
  }
  interface ThemeOptions {
    status?: {
      paid?: string;
      sent?: string;
      draft?: string;
      overdue?: string;
      partiallyPaid?: string;
      viewed?: string;
      cancelled?: string;
    };
  }
}

// Create theme with proper light and dark mode configurations
export const theme = createTheme({
  typography: {
    fontFamily: roboto.style.fontFamily,
    h1: {
      fontSize: "2.5rem",
      fontWeight: 600,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 600,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 600,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  palette: {
    mode: "light",
    primary: {
      main: "#4F46E5",
      light: "#6366F1",
      dark: "#4338CA",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#10B981",
      light: "#34D399",
      dark: "#059669",
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#EF4444",
      light: "#F87171",
      dark: "#DC2626",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#F59E0B",
      light: "#FCD34D",
      dark: "#D97706",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#3B82F6",
      light: "#60A5FA",
      dark: "#2563EB",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#10B981",
      light: "#34D399",
      dark: "#059669",
      contrastText: "#FFFFFF",
    },
    grey: {
      50: "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      300: "#D1D5DB",
      400: "#9CA3AF",
      500: "#6B7280",
      600: "#4B5563",
      700: "#374151",
      800: "#1F2937",
      900: "#111827",
    },
    background: {
      default: "#F9FAFB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#6B7280",
      disabled: "#9CA3AF",
    },
    divider: "#E5E7EB",
    action: {
      active: "#6B7280",
      hover: alpha("#111827", 0.04),
      selected: alpha("#111827", 0.08),
      disabled: "#9CA3AF",
      disabledBackground: "#F3F4F6",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          minHeight: "100vh",
        },
        body: {
          minHeight: "100vh",
          scrollbarColor: "#9CA3AF #F3F4F6",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#9CA3AF",
            border: "2px solid #F3F4F6",
          },
          "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {
            backgroundColor: "#F3F4F6",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
          },
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#4338CA",
          },
        },
        sizeLarge: {
          padding: "12px 24px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #E5E7EB",
        },
        head: {
          fontWeight: 600,
          backgroundColor: "#F9FAFB",
          color: "#374151",
          fontSize: "0.875rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "#F9FAFB",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        colorDefault: {
          backgroundColor: "#E5E7EB",
          color: "#374151",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
          backgroundImage: "none",
          backgroundColor: "#FFFFFF",
          color: "#111827",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
          backgroundImage: "none",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined" as const,
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#FFFFFF",
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1F2937",
          color: "#F9FAFB",
          fontSize: "0.875rem",
          borderRadius: 6,
          padding: "8px 12px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        },
        arrow: {
          color: "#1F2937",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardInfo: {
          backgroundColor: alpha("#3B82F6", 0.1),
          color: "#1E40AF",
        },
        standardSuccess: {
          backgroundColor: alpha("#10B981", 0.1),
          color: "#065F46",
        },
        standardWarning: {
          backgroundColor: alpha("#F59E0B", 0.1),
          color: "#92400E",
        },
        standardError: {
          backgroundColor: alpha("#EF4444", 0.1),
          color: "#991B1B",
        },
      },
    },
  },
  status: {
    paid: "#10B981",
    sent: "#3B82F6",
    viewed: "#F59E0B",
    draft: "#6B7280",
    overdue: "#EF4444",
    partiallyPaid: "#F59E0B",
    cancelled: "#6B7280",
  },
});

// Dark theme configuration
export const darkTheme = createTheme({
  ...theme,
  palette: {
    mode: "dark",
    primary: {
      main: "#818CF8",
      light: "#A5B4FC",
      dark: "#6366F1",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#34D399",
      light: "#6EE7B7",
      dark: "#10B981",
      contrastText: "#000000",
    },
    error: {
      main: "#F87171",
      light: "#FCA5A5",
      dark: "#EF4444",
      contrastText: "#000000",
    },
    warning: {
      main: "#FCD34D",
      light: "#FDE68A",
      dark: "#F59E0B",
      contrastText: "#000000",
    },
    info: {
      main: "#60A5FA",
      light: "#93BBFD",
      dark: "#3B82F6",
      contrastText: "#000000",
    },
    success: {
      main: "#34D399",
      light: "#6EE7B7",
      dark: "#10B981",
      contrastText: "#000000",
    },
    grey: {
      50: "#1F2937",
      100: "#374151",
      200: "#4B5563",
      300: "#6B7280",
      400: "#9CA3AF",
      500: "#D1D5DB",
      600: "#E5E7EB",
      700: "#F3F4F6",
      800: "#F9FAFB",
      900: "#FFFFFF",
    },
    background: {
      default: "#0F172A",
      paper: "#1E293B",
    },
    text: {
      primary: "#F9FAFB",
      secondary: "#D1D5DB",
      disabled: "#9CA3AF",
    },
    divider: "#374151",
    action: {
      active: "#D1D5DB",
      hover: alpha("#F9FAFB", 0.08),
      selected: alpha("#F9FAFB", 0.12),
      disabled: "#6B7280",
      disabledBackground: "#374151",
    },
  },
  components: {
    ...theme.components,
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          minHeight: "100vh",
        },
        body: {
          minHeight: "100vh",
          scrollbarColor: "#6B7280 #1E293B",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#6B7280",
            border: "2px solid #1E293B",
          },
          "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {
            backgroundColor: "#1E293B",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#1E293B",
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#1E293B",
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)",
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #374151",
          backgroundColor: "transparent",
        },
        head: {
          backgroundColor: "#111827",
          color: "#E5E7EB",
        },
        body: {
          color: "#E5E7EB",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          "&:hover": {
            backgroundColor: alpha("#F9FAFB", 0.05),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorDefault: {
          backgroundColor: "#374151",
          color: "#E5E7EB",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#1E293B",
          color: "#F9FAFB",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#1E293B",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#0F172A",
            color: "#F9FAFB",
            caretColor: "#F9FAFB",
            "& fieldset": {
              borderColor: "#374151",
            },
            "&:hover fieldset": {
              borderColor: "#4B5563",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#818CF8",
            },
            "& input": {
              caretColor: "#F9FAFB",
              "&::selection": {
                backgroundColor: "#818CF8",
                color: "#FFFFFF",
              },
            },
            "& textarea": {
              caretColor: "#F9FAFB",
              "&::selection": {
                backgroundColor: "#818CF8",
                color: "#FFFFFF",
              },
            },
          },
          "& .MuiInputLabel-root": {
            color: "#9CA3AF",
            "&.Mui-focused": {
              color: "#818CF8",
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#374151",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#4B5563",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#818CF8",
          },
        },
        select: {
          backgroundColor: "#0F172A",
          color: "#F9FAFB",
          "&.MuiSelect-select": {
            color: "#F9FAFB",
          },
        },
        icon: {
          color: "#9CA3AF",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: "#F9FAFB",
          caretColor: "#F9FAFB",
          "& input": {
            color: "#F9FAFB",
            caretColor: "#F9FAFB",
            "&::placeholder": {
              color: "#6B7280",
              opacity: 1,
            },
          },
          "& textarea": {
            color: "#F9FAFB",
            caretColor: "#F9FAFB",
            "&::placeholder": {
              color: "#6B7280",
              opacity: 1,
            },
          },
        },
        input: {
          color: "#F9FAFB",
          "&::placeholder": {
            color: "#6B7280",
            opacity: 1,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: "#F9FAFB",
          "& input": {
            color: "#F9FAFB",
            caretColor: "#F9FAFB",
          },
          "& textarea": {
            color: "#F9FAFB",
            caretColor: "#F9FAFB",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#374151",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#4B5563",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#818CF8",
          },
        },
        input: {
          color: "#F9FAFB",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&:hover": {
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.3)",
          },
        },
        containedPrimary: {
          backgroundColor: "#6366F1",
          "&:hover": {
            backgroundColor: "#818CF8",
          },
        },
        outlinedPrimary: {
          borderColor: "#6366F1",
          color: "#818CF8",
          "&:hover": {
            borderColor: "#818CF8",
            backgroundColor: alpha("#818CF8", 0.08),
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardInfo: {
          backgroundColor: alpha("#60A5FA", 0.2),
          color: "#93BBFD",
        },
        standardSuccess: {
          backgroundColor: alpha("#34D399", 0.2),
          color: "#6EE7B7",
        },
        standardWarning: {
          backgroundColor: alpha("#FCD34D", 0.2),
          color: "#FDE68A",
        },
        standardError: {
          backgroundColor: alpha("#F87171", 0.2),
          color: "#FCA5A5",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: "#6366F1",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: "#818CF8",
            },
            "& .MuiListItemIcon-root": {
              color: "#FFFFFF",
            },
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          "& .MuiInputLabel-root": {
            color: "#9CA3AF",
          },
          "& .MuiFormLabel-root": {
            color: "#9CA3AF",
          },
          "& .MuiFormHelperText-root": {
            color: "#9CA3AF",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#9CA3AF",
          "&.Mui-focused": {
            color: "#818CF8",
          },
          "&.Mui-error": {
            color: "#F87171",
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: "#9CA3AF",
          "&.Mui-focused": {
            color: "#818CF8",
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: "#9CA3AF",
          "&.Mui-error": {
            color: "#F87171",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#F9FAFB",
          color: "#111827",
          fontSize: "0.875rem",
          borderRadius: 6,
          padding: "8px 12px",
          boxShadow: "0 4px 6px -1px rgb(255 255 255 / 0.1), 0 2px 4px -2px rgb(255 255 255 / 0.1)",
        },
        arrow: {
          color: "#F9FAFB",
        },
      },
    },
  },
  status: {
    paid: "#34D399",
    sent: "#60A5FA",
    viewed: "#FCD34D",
    draft: "#9CA3AF",
    overdue: "#F87171",
    partiallyPaid: "#FCD34D",
    cancelled: "#9CA3AF",
  },
});
