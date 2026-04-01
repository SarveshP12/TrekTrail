import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ text, variant = 'default', style }: BadgeProps) {
  const { colors, radii } = useTheme();

  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: colors.surfaceElevated, text: colors.textSecondary },
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    error: { bg: colors.errorLight, text: colors.error },
    info: { bg: colors.elevationLight, text: colors.elevation },
  };

  const v = variantColors[variant];

  return (
    <View
      style={[
        {
          backgroundColor: v.bg,
          borderRadius: radii.full,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: v.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
        {text}
      </Text>
    </View>
  );
}
