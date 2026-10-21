# ClimaTemp

App móvil mínima con **React Native + Expo (TypeScript)** que muestra **solo la temperatura actual** y el lugar, en dos pestañas:

1. **Mi ubicación** — obtiene el GPS del dispositivo, resuelve el nombre del lugar y muestra la temperatura actual.
2. **Buscar ciudad** — busca cualquier ciudad y muestra su temperatura actual (la última búsqueda se recuerda).

Sin API keys, sin gráficas, sin pronósticos, sin humedad ni viento.

## Requisitos

- Node.js 20 o superior
- Expo Go en el teléfono (Android/iOS) o un navegador para la versión web

## Instalar y ejecutar

```bash
npm install
npx expo start
```

Desde la terminal puedes abrir directamente en una plataforma:

```bash
npx expo start --android
npx expo start --ios
npx expo start --web
```

Verificación de tipos (opcional):

```bash
npm run typecheck
```

## APIs utilizadas (todas sin API key)

| Uso | Endpoint |
|---|---|
| Temperatura actual | `https://api.open-meteo.com/v1/forecast?current=temperature_2m` |
| Búsqueda de ciudad | `https://geocoding-api.open-meteo.com/v1/search` |
| Nombre del lugar (GPS) | `https://nominatim.openstreetmap.org/reverse` (Reverse Geocoding) |

Nominatim exige identificar la aplicación, por eso las peticiones incluyen la cabecera
`User-Agent: ClimaTemp/1.0 (+https://github.com/hugoamedinao27/Estacion_metereologica)`
(en web la omite porque el navegador no permite modificarla).

## Permisos de ubicación

- **iOS**: se declara `NSLocationWhenInUseUsageDescription` mediante el plugin `expo-location`.
- **Android**: el plugin `expo-location` añade `ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION`.
- Si el permiso se deniega, la app lo indica y ofrece el acceso a los ajustes del sistema.
- Las app nativas (build con EAS o `npx expo prebuild`) también funcionan con `expo-location`.

## Nota sobre web y HTTPS

La geolocalización del navegador solo está disponible en un **contexto seguro (HTTPS)** o en `localhost`.
Si pruebas la versión web desde el teléfono, usa el túnel de Expo para que la URL sea HTTPS:

```bash
npx expo start --tunnel
```

## Estructura

```
App.tsx                    Navegación (2 tabs) y tema global
app.json                   Configuración de Expo (permisos, plugin expo-location)
src/
  api/http.ts              fetch con timeout y errores tipados
  api/openMeteo.ts         Temperatura actual y geocoding
  api/nominatim.ts         Reverse geocoding
  api/place.ts             Formatea "Ciudad, País"
  components/              Card de temperatura, botón, mensaje de error
  screens/                 MyLocationScreen, CitySearchScreen
  storage/lastSearch.ts    Última búsqueda con AsyncStorage
  utils/                   Formato de temperatura, timeout, mensajes de error
  theme.ts                 Colores (blanco, gris, azul) y espaciado
```
