import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Mode = 'light' | 'dark';
const KEY = 'stagetrack.theme';

const ThemeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => undefined });

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    document.body.style.background = mode === 'dark' ? '#141414' : '#f5f5f5';
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeContext);
