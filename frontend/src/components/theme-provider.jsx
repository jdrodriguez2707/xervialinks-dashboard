import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const initialState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
  toggleThemeWithTransition: () => null,
};

const ThemeProviderContext = createContext(initialState);

function applyDomTheme(themeValue) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  if (themeValue === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
    return systemTheme;
  }
  root.classList.add(themeValue);
  return themeValue;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(storageKey) || defaultTheme);

  const resolvedTheme = useMemo(() => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme === "dark" ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      applyDomTheme("system");
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      localStorage.setItem(storageKey, value);
      return value;
    });
  }, [storageKey]);

  const toggleThemeWithTransition = useCallback(() => {
    const currentResolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    const next = currentResolved === "dark" ? "light" : "dark";

    const apply = () => {
      localStorage.setItem(storageKey, next);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(next);
      setThemeState(next);
    };

    if (typeof document === "undefined" || !document.startViewTransition) {
      apply();
      return;
    }

    const transition = document.startViewTransition(() => {
      apply();
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: ["inset(0 0 100% 0)", "inset(0)"] },
          { pseudoElement: "::view-transition-new(root)", duration: 600 },
        );
      })
      .catch(() => {});
  }, [storageKey, theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleThemeWithTransition,
    }),
    [theme, resolvedTheme, setTheme, toggleThemeWithTransition],
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
