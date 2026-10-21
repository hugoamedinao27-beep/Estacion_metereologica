import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentTemperature } from '../api/openMeteo';
import { reverseGeocode } from '../api/nominatim';
import Button from '../components/Button';
import ErrorText from '../components/ErrorText';
import TemperatureCard from '../components/TemperatureCard';
import { colors, spacing } from '../theme';
import { describeError } from '../utils/errors';
import { withTimeout } from '../utils/timeout';

const LOCATION_TIMEOUT_MS = 15000;

export default function MyLocationScreen() {
  const [place, setPlace] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('GPS no disponible');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setNeedsPermission(false);
        setPermissionDenied(true);
        setError('Permiso de ubicación denegado');
        return;
      }
      setNeedsPermission(false);
      setPermissionDenied(false);

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS
      );
      const { latitude, longitude } = position.coords;

      const [currentTemperature, currentPlace] = await Promise.all([
        getCurrentTemperature(latitude, longitude),
        reverseGeocode(latitude, longitude).catch(() => 'Ubicación actual'),
      ]);

      setTemperature(currentTemperature);
      setPlace(currentPlace);
    } catch (loadError) {
      setError(describeError(loadError, 'GPS no disponible'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (active && permission.granted) {
          setNeedsPermission(false);
          load();
        }
      } catch {
        // Si no se puede leer el permiso, se pide al pulsar el botón.
      }
    })();

    return () => {
      active = false;
    };
  }, [load]);

  const openSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  const showResult = place !== null && temperature !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.hint}>Obteniendo tu ubicación…</Text>
          </View>
        ) : null}

        {!loading && needsPermission ? (
          <View style={styles.card}>
            <Text style={styles.title}>Ubicación</Text>
            <Text style={styles.description}>
              ClimaTemp necesita tu ubicación para mostrar la temperatura de donde estás.
            </Text>
            <View style={styles.action}>
              <Button label="Permitir ubicación" onPress={load} />
            </View>
          </View>
        ) : null}

        {!loading && !needsPermission && showResult ? (
          <TemperatureCard place={place} temperature={temperature} />
        ) : null}

        {!loading && !needsPermission && error ? <ErrorText message={error} /> : null}

        {permissionDenied && Platform.OS !== 'web' ? (
          <View style={styles.action}>
            <Button label="Abrir ajustes" onPress={openSettings} />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          label="Actualizar"
          onPress={load}
          disabled={loading}
        />
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  center: {
    alignItems: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  action: {
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
