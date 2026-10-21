export type PlaceAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

export function formatPlace(address: PlaceAddress | undefined, fallbackName?: string): string {
  const place =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    address?.state ??
    fallbackName;
  const country = address?.country;

  if (!place && !country) {
    throw new Error('Lugar sin nombre');
  }
  return [place, country].filter(Boolean).join(', ');
}
