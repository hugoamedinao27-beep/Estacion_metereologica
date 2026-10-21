import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import { formatTemperature } from '../utils/format';

type Props = {
  place: string;
  temperature: number;
};

export default function TemperatureCard({ place, temperature }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.place}>{place}</Text>
      <Text style={styles.temperature}>{formatTemperature(temperature)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  place: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  temperature: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '600',
  },
});
