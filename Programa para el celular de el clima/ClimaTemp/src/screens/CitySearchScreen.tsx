import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentTemperature, searchCity } from '../api/openMeteo';
import Button from '../components/Button';
import ErrorText from '../components/ErrorText';
import TemperatureCard from '../components/TemperatureCard';
import { loadLastSearch, saveLastSearch } from '../storage/lastSearch';
import { colors, spacing } from '../theme';
import type { StoredSearch } from '../types';
import { describeError } from '../utils/errors';

export default function CitySearchScreen() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<StoredSearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadLastSearch().then((stored) => {
      if (!active || !stored) {
        return;
      }
      setResult(stored);
      setQuery(stored.place.split(',')[0]);
    });

    return () => {
      active = false;
    };
  }, []);

  const search = async () => {
    const text = query.trim();
    if (!text || loading) {
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    try {
      const match = await searchCity(text);
      if (!match) {
        setError('Ciudad no encontrada');
        return;
      }

      const temperature = await getCurrentTemperature(match.latitude, match.longitude);
      const place = [match.name, match.country].filter(Boolean).join(', ');
      const stored: StoredSearch = { place, temperature, searchedAt: Date.now() };

      setResult(stored);
      await saveLastSearch(stored);
    } catch (searchError) {
      setError(describeError(searchError, 'No se pudo completar la búsqueda'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.search}>
          <TextInput
            style={styles.input}
            placeholder="Buscar ciudad..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          <Pressable
            accessibilityRole="button"
            disabled={loading || query.trim().length === 0}
            onPress={search}
            style={({ pressed }) => [
              styles.searchButton,
              (loading || query.trim().length === 0) && styles.searchButtonDisabled,
              pressed && styles.searchButtonPressed,
            ]}
          >
            <Text style={styles.searchButtonLabel}>Buscar</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!loading && result ? (
          <TemperatureCard place={result.place} temperature={result.temperature} />
        ) : null}

        {!loading && error ? <ErrorText message={error} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    height: 46,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  searchButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  searchButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  searchButtonDisabled: {
    backgroundColor: colors.border,
  },
  searchButtonLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
  },
});
