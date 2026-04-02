import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Ionicons } from '@expo/vector-icons';

interface AvatarProps {
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, size = 48, style }: AvatarProps) {
  const { colors } = useTheme();

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primaryLight + '30',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.primary + '40',
        },
        style,
      ]}
    >
      {name ? (
        <Text style={{ color: colors.primary, fontSize: size * 0.36, fontWeight: '700' }}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.45} color={colors.primary} />
      )}
    </View>
  );
}
