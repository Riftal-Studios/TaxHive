"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { ThemeProvider as MUIThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { SnackbarProvider } from "notistack";
import { theme as lightTheme, darkTheme } from "@/lib/theme";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: "light" | "dark" | "system";
}

// Read dark mode from the DOM class list without triggering a setState-in-effect lint error.
// useSyncExternalStore ensures server/client consistency: getServerSnapshot returns false (light)
// and getSnapshot reads the actual DOM class after hydration.
function useInitialDarkMode(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    // We only need the initial value; no live subscription needed.
    // Return a no-op unsubscribe.
    void cb;
    return () => {};
  }, []);
  const getSnapshot = () =>
    document.documentElement.classList.contains("dark");
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeProvider({
  children,
  defaultMode = "system",
}: ThemeProviderProps) {
  // useSyncExternalStore returns false on server (matching SSR) and reads
  // the actual <html> class on client, avoiding hydration mismatch.
  const initialDark = useInitialDarkMode();
  const [isDarkMode, setIsDarkMode] = useState(initialDark);

  useEffect(() => {
    // Update the document class for Tailwind dark mode
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Listen for system theme changes
    if (defaultMode === "system" && !localStorage.getItem("theme")) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [defaultMode]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
  };

  const activeTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <MUIThemeProvider theme={activeTheme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          autoHideDuration={5000}
        >
          {children}
        </SnackbarProvider>
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}
