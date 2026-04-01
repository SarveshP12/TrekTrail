import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function StatCard({ label, value, unit, color }: { label: string, value: string, unit?: string, color?: string }) {
  const { colors, typography, radii } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
      <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.stat as any, { color: color ?? colors.text }]}>
        {value}
        {unit && <Text style={[typography.body as any, { color: colors.textSecondary }]}> {unit}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3 },
});
