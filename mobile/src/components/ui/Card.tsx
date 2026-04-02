import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: number;
}

export function Card({ children, style, variant = 'default', padding }: CardProps) {
  const { colors, radii, shadows, spacing } = useTheme();

  const base: ViewStyle = {
    backgroundColor: variant === 'elevated' ? colors.surfaceElevated : colors.card,
    borderRadius: radii.lg,
    padding: padding ?? spacing.md,
    ...(variant === 'outlined' ? { borderWidth: 1, borderColor: colors.border } : {}),
    ...(variant !== 'outlined' ? shadows.sm : {}),
  };

  return <View style={[base, style]}>{children}</View>;
}
