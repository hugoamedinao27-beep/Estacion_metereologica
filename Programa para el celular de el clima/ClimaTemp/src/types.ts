export type CityMatch = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type StoredSearch = {
  place: string;
  temperature: number;
  searchedAt: number;
};
