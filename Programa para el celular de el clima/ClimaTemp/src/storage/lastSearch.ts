import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredSearch } from '../types';

const STORAGE_KEY = '@climatemp/last_search';

export async function saveLastSearch(search: StoredSearch): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(search));
  } catch {
    // Si no se puede guardar, la búsqueda actual igual se muestra en pantalla.
  }
}

export async function loadLastSearch(): Promise<StoredSearch | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSearch;
    if (typeof parsed?.place !== 'string' || typeof parsed?.temperature !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
