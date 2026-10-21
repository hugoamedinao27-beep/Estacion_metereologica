import { Platform } from 'react-native';

import { fetchJson } from './http';
import { formatPlace } from './place';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'ClimaTemp/1.0 (+https://github.com/hugoamedinao27/Estacion_metereologica)';

type NominatimResponse = {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const url = `${NOMINATIM_URL}?format=jsonv2&zoom=10&lat=${latitude}&lon=${longitude}`;

  // En web el navegador controla la cabecera User-Agent y no permite cambiarla.
  const headers =
    Platform.OS === 'web' ? undefined : { 'User-Agent': USER_AGENT, Accept: 'application/json' };

  const data = await fetchJson<NominatimResponse>(url, headers);
  return formatPlace(data.address, data.name);
}
