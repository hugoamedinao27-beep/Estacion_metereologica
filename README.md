# 🌦️ MeteoGuard · Estación Meteorológica IoT

**Estado:** ✅ Funcional · **Despliegue:** ☁️ Azure VM · **Arquitectura:** 🏗️ MVC · **Licencia:** 📄 Académica

> Demo estática de una estación meteorológica IoT con dashboard en vivo, alertas configurables, historial y consulta de clima por ciudad y geolocalización.

## 📖 Descripción general

**MeteoGuard** es una aplicación web que simula una estación meteorológica IoT. Mide **temperatura** y **humedad**, clasifica el ambiente en **estados de alerta** (Frío, Normal, Precaución, Calor, Crítico) y permite **configurar los umbrales** que definen cada estado. Además, integra datos reales de clima por **ciudad** y por **geolocalización (GPS)** usando APIs públicas.

Esta versión es una **demo estática**: toda la lógica corre en el navegador (JavaScript vanilla), sin backend. Es la réplica estática de la aplicación **ASP.NET Core MVC** del proyecto oficial, la cual se despliega en **Azure App Service**.

**Repositorio del proyecto MVC completo:**  
<https://github.com/hugoamedinao27-beep/Estacion_metereologica>

## ✨ Características principales

- **Dashboard en vivo**: temperatura y humedad actualizadas automáticamente.
- **Alertas configurables**: cinco estados con umbrales personalizables y validación.
- **Historial y gráficos**: últimas lecturas y tendencias con Chart.js.
- **Clima por ciudad**: búsqueda mundial con pronóstico de 5 días (Open-Meteo).
- **Clima por geolocalización**: detecta tu ubicación y muestra el clima actual.
- **Modo claro / oscuro** persistente.
- **Persistencia local** mediante `localStorage`.

## 🏗️ Arquitectura (MVC)

El proyecto sigue el patrón **Modelo – Vista – Controlador** implementado en JavaScript puro. Cada capa tiene una responsabilidad única y se comunica con las demás a través de una API pública.

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Modelo** | `wwwroot/js/weatherModel.js` | Lógica de negocio: simulación de sensores, cálculo de estados, validación de umbrales, KPIs, persistencia (`localStorage`) y consumo de APIs externas. |
| **Vista** | `wwwroot/js/weatherView.js` | Renderizado del DOM: dashboard, gráficos (Chart.js), tabla de historial, tarjetas de clima, formularios y mensajes. |
| **Controlador** | `wwwroot/js/weatherController.js` | Orquesta eventos, coordina Modelo y Vista, inicializa la app y gestiona temporizadores. |
| **Interacciones UI** | `wwwroot/js/site.js` | Menú móvil responsive. |

**Flujo típico de una acción:**

## 🧰 Tecnologías utilizadas

**Frontend**
- HTML5 · CSS3 · JavaScript ES6+

**Librerías**
- Chart.js 4.4.7

**APIs externas**
- Open-Meteo (geocoding + forecast)
- Nominatim / OpenStreetMap (reverse geocoding)

**Persistencia**
- LocalStorage (navegador)

**Infraestructura**
- Azure Virtual Machine

## 📁 Estructura del proyecto

Estacion_metereologica/
│
├── index.html                      # Página principal (demo estática)
├── README.md                       # Este archivo
│
├── wwwroot/
│   ├── css/
│   │   └── styles.css              # Estilos globales y temas
│   └── js/
│       ├── site.js                 # Interacciones de UI (menú móvil)
│       ├── weatherModel.js         # Capa Modelo (MVC)
│       ├── weatherView.js          # Capa Vista (MVC)
│       └── weatherController.js    # Capa Controlador (MVC)
│
└── demo/
    ├── demo.js                     # Simulación y persistencia
    ├── weather.js                  # Clima por ciudad
    └── weather-geo.js              # Clima por geolocalización
