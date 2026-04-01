import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { StatCard } from '../../src/components/ui/StatCard';
import { Button } from '../../src/components/ui/Button';

export default function TrekSummaryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.h1 as any, { color: colors.text, padding: spacing.lg, marginTop: 40 }]}>
        Trek Summary
      </Text>
      
      <View style={{ paddingHorizontal: spacing.md }}>
        <Text style={[typography.h2 as any, { color: colors.primary, marginBottom: spacing.md }]}>Session: {id}</Text>
        
        <StatCard label="Distance" value="5.2" unit="km" />
        <StatCard label="Duration" value="1h 20m" />
        <StatCard label="Elevation Gained" value="320" unit="m" />
        <StatCard label="Average Speed" value="4.1" unit="km/h" />

        <View style={styles.chartPlaceholder}>
          <Text style={{ color: colors.textSecondary }}>Elevation Profile Chart Here</Text>
        </View>

        <Button title="Back to Home" onPress={() => router.push('/(tabs)/home')} style={{ marginTop: spacing.xl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chartPlaceholder: { height: 150, backgroundColor: '#1a1f2e', marginTop: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }
});
