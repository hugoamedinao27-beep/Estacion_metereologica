import type { CityMatch } from '../types';
import { fetchJson } from './http';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

type ForecastResponse = {
  current?: { temperature_2m?: number };
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

export async function getCurrentTemperature(
  latitude: number,
  longitude: number
): Promise<number> {
  const url =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m&timezone=auto';

  const data = await fetchJson<ForecastResponse>(url);
  const temperature = data.current?.temperature_2m;

  if (typeof temperature !== 'number') {
    throw new Error('Respuesta sin temperatura');
  }
  return temperature;
}

export async function searchCity(query: string): Promise<CityMatch | null> {
  const url =
    `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=es&format=json`;

  const data = await fetchJson<GeocodingResponse>(url);
  const result = data.results?.[0];

  if (!result) {
    return null;
  }
  return {
    name: result.name,
    country: result.country ?? '',
    latitude: result.latitude,
    longitude: result.longitude,
  };
}
