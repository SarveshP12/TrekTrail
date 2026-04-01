import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ElevationProfileProps {
  data: number[];
  height?: number;
  showLabels?: boolean;
}

/**
 * Pure React Native elevation profile chart.
 * Renders a filled area chart using View elements — no SVG dependency needed.
 */
export function ElevationProfile({ data, height = 140, showLabels = true }: ElevationProfileProps) {
  const { colors, radii, spacing, typography } = useTheme();

  if (!data || data.length < 2) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.surfaceElevated, borderRadius: radii.lg }]}>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          Not enough elevation data
        </Text>
      </View>
    );
  }

  const minAlt = Math.min(...data);
  const maxAlt = Math.max(...data);
  const range = maxAlt - minAlt || 1;
  const chartWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2;

  // Downsample to max 60 bars for performance
  const maxBars = 60;
  const step = Math.max(1, Math.floor(data.length / maxBars));
  const sampled = data.filter((_, i) => i % step === 0);
  const barWidth = chartWidth / sampled.length;

  return (
    <View style={{ marginTop: spacing.md }}>
      <View
        style={[
          styles.chartContainer,
          { height, backgroundColor: colors.surfaceElevated, borderRadius: radii.lg },
        ]}
      >
        <View style={styles.barsContainer}>
          {sampled.map((alt, i) => {
            const normalized = (alt - minAlt) / range;
            const barHeight = Math.max(4, normalized * (height - 24));
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    width: barWidth - 1,
                    height: barHeight,
                    backgroundColor: colors.elevation + '80',
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Gradient overlay at the bottom */}
        <View style={[styles.gradientLine, { backgroundColor: colors.elevation }]} />
      </View>

      {showLabels && (
        <View style={styles.labels}>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            ↓ {minAlt.toFixed(0)}m
          </Text>
          <Text style={[typography.caption, { color: colors.elevation }]}>
            ↑ {maxAlt.toFixed(0)}m
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartContainer: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 8,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  bar: {
    marginHorizontal: 0.5,
  },
  gradientLine: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.5,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
