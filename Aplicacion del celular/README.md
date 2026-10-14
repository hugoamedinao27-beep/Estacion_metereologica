# PetSafe IoT

Aplicación móvil de **monitoreo y control ambiental para mascotas** sobre un
ESP32 con sensor DHT22. Tema claro con acentos azules, cuatro estados
térmicos (Frío / Normal / Calor / Crítico) y control automático del ventilador
que funciona **independientemente del teléfono**.

## Qué incluye

| Pantalla | Contenido |
|---|---|
| **Inicio (Dashboard)** | Medidores de temperatura y humedad, banner de estado, actuador del ventilador con modo AUTO/MANUAL, gráfico de las últimas 1 / 6 / 24 h con bandas de umbral, estadísticas y estado de la conexión ESP32 |
| **Historial** | Registro de eventos codificado por color, agrupado por día, filtros por estado, búsqueda de estado y exportación a CSV |
| **Ajustes** | Umbrales de temperatura (Frío / Calor / Crítico) con barra de zonas en vivo, rango de humedad, 5 interruptores (2 de ellos como función futura), perfil de la mascota, intervalo de muestreo y botón **APLICAR CAMBIOS** |

### Comportamiento

- **Máquina de estados** — `≤ 20 °C` Frío · `21–26 °C` Normal · `27 °C` Calor ·
  `≥ 28 °C` Crítico. Los umbrales son configurables y se recalculan al vuelo.
- **Control automático** — el ESP32 enciende el ventilador al entrar en Calor o
  Crítico, sin necesidad de que la app esté abierta. El usuario puede tomar el
  control manualmente en cualquier momento.
- **Alertas** — notificación local + vibración en cada cambio de estado, hoja
  modal emergente en estado Crítico e insignia en la pestaña Historial.
- **Persistencia** — todo se guarda en `localStorage`: ajustes, lecturas y hasta
  500 eventos de historial.
- **Dos fuentes de datos** — un simulador térmico por defecto (para probar la
  app sin hardware) y conexión **Web Serial** a un ESP32 real por USB.

## Estructura

```
PetSafeIoT/
├─ www/                     aplicación web (HTML/CSS/JS sin framework)
│  ├─ index.html
│  ├─ css/app.css
│  └─ js/
│     ├─ store.js           estado, persistencia y máquina de estados
│     ├─ sensor.js          simulador + Web Serial del ESP32
│     ├─ chart.js           gráfico SVG sin dependencias
│     ├─ notifier.js        notificaciones locales y vibración
│     ├─ ui.js              capa de presentación
│     └─ app.js             arranque, navegación y eventos
├─ firmware/PetSafeESP32/   sketch de Arduino para el ESP32
├─ tools/
│  ├─ gen-icons.js          genera los iconos PNG (sin dependencias)
│  └─ smoke.js              52 pruebas end-to-end vía Chrome DevTools
├─ keystore/                clave de firma de la versión release
└─ android/                 proyecto nativo generado por Capacitor
```

## Compilar la APK

```powershell
cd android
.\gradlew.bat assembleRelease     # APK firmada de publicación
.\gradlew.bat assembleDebug       # APK de depuración
```

Salida: `android/app/build/outputs/apk/release/app-release.apk`

### Requisitos del entorno

- **JDK 21** — obligatorio: Android Gradle Plugin 8.13 no admite el JDK 26 que
  trae Windows por defecto. En este equipo el JDK 21 portable está en
  `tools/jdk21/` y se usa mediante `org.gradle.java.home` en
  `android/gradle.properties`. **En otro equipo, cambia esa línea** por tu ruta
  de JDK 21 o bórrala y define `JAVA_HOME`.
- **Android SDK** con `compileSdk 36` y `build-tools 36.0.0`. La ruta se guarda
  en `android/local.properties` (`sdk.dir=…`), que no se versiona.

> `tools/` incluye `gen-icons.js`, `smoke.js`, `layout-audit.js` y
> `check-screenshot.js`; ninguno necesita dependencias de npm.

Antes de cualquier cambio en `www/`:

```powershell
npx cap sync android
```

## Probar la app en un dispositivo

```powershell
adb shell pm clear com.petsafe.iot
adb shell am start -n com.petsafe.iot/.MainActivity

# banco de pruebas (52 comprobaciones sobre el DOM real)
adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
node tools/smoke.js
```

## Conectar un ESP32 real

1. Graba `firmware/PetSafeESP32/PetSafeESP32.ino` con tus credenciales de Wi-Fi.
   · DHT22 en **GPIO4**, relé del ventilador en **GPIO5**, LED en **GPIO2**.
2. Ajusta los umbrales `LIM_COLD`, `LIM_HOT`, `LIM_CRIT` (o déjalos y
   configúralos desde la app).
3. En la app, ve a **Conexión ESP32 → Conectar por USB** y elige el puerto
   serie a 115 baudios. La app sustituye el simulador por la lectura real.
4. El ESP32 acepta `{"cmd":"fan","on":1}`, `{"cmd":"auto","on":1}` y
   `{"cmd":"limits","cold":20,"hot":27,"crit":28}`.

> Web Serial requiere Chrome/Chromium. En el WebView de Android esta función
> puede no estar disponible; en ese caso la app funciona con el simulador o con
> una reenvío de puerto serie desde el PC.

## Firmas

- **Debug** — clave de depuración de Android, para instalar y probar.
- **Release** — firmada con `keystore/petsafe-release.jks`
  (alias `petsafe`, contraseña `petsafe2026`). Sustitúyela por tu propia clave
  antes de publicar en Google Play.

## Extensiones futuras

Preparadas en la interfaz como funciones deshabilitadas:

- **Aire IR** — control remoto de un aire acondicionado por módulo infrarrojo.
- **Sensor de agua** — detección de charcos y humedad residual alrededor del
  comedero o la cama de la mascota.

Ambas aparecen en Ajustes con la etiqueta `FUTURO` y no pueden activarse.