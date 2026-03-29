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
import { ThemeRegistry } from "./theme-registry";

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

function useDocumentDarkClass(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
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
  const initialDark = useDocumentDarkClass();
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
    <ThemeRegistry>
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
    </ThemeRegistry>
  );
}
