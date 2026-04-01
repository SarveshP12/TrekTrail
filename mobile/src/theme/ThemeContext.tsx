import React, { createContext, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { colors, typography, spacing, radii } from './tokens';

type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: typeof colors.light;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  toggle: () => void;
}

export const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme() ?? 'light';
  const [mode, setMode] = useState<ThemeMode>(systemMode);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const theme: Theme = { mode, colors: colors[mode], typography, spacing, radii, toggle };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
