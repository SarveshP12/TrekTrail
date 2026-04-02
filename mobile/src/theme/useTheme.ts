import { useContext } from 'react';
import { ThemeContext, Theme } from './ThemeContext';
import { colors, typography, spacing, radii } from './tokens';

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) return { mode: 'dark', colors: colors.dark, typography, spacing, radii, toggle: () => {} };
  return theme;
}
