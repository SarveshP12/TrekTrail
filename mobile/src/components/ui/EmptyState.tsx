import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'compass-outline', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.primary + '15', borderColor: colors.primary + '25' },
        ]}
      >
        <Ionicons name={icon as any} size={48} color={colors.primary} />
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 },
          ]}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
