import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ title, variant = 'primary', style, ...props }: Props) {
  const { colors, typography, radii } = useTheme();
  
  const bg = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surface : 'transparent';
  const textColor = variant === 'primary' ? '#fff' : colors.primary;
  const borderWidth = variant === 'outline' ? 1 : 0;

  return (
    <TouchableOpacity 
      style={[styles.btn, { backgroundColor: bg, borderRadius: radii.md, borderColor: colors.primary, borderWidth }, style]} 
      {...props}
    >
      <Text style={[typography.h3 as any, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 16, alignItems: 'center', justifyContent: 'center' }
});
