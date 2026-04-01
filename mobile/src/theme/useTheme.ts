import { useContext } from 'react';
import { ThemeContext, Theme } from './ThemeContext';

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) return { mode: 'dark', colors: require('./tokens').colors.dark, typography: require('./tokens').typography, spacing: require('./tokens').spacing, radii: require('./tokens').radii, toggle: () => {} };
  return theme;
}
