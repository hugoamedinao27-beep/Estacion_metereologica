# Justificación de la arquitectura — MeteoGuard

## 1. Problema

Invernaderos, bodegas, viviendas y espacios agrícolas sufren variaciones de temperatura y
humedad que no se miden de forma continua. Sin datos no hay forma de anticipar heladas,
calor extremo ni humedad dañina. **Usuarios objetivo**: propietarios de cultivos bajo cubierta,
bodegas y hogares que quieren monitorear el ambiente a distancia.

## 2. Requerimientos funcionales

1. Dashboard con temperatura, humedad y estado de alerta en tiempo real (datos simulados de un sensor DHT22).
2. Estados de alerta: Frío, Normal, Precaución, Calor y Crítico, con umbrales definidos por el usuario.
3. Configuración de umbrales desde la interfaz, con validaciones y mensajes de respuesta.
4. Historial de lecturas con tabla y gráficos de tendencia.

## 3. Requerimientos no funcionales

- Interfaz adaptable a distintos tamaños de pantalla.
- Persistencia de datos de lecturas y configuración.
- Despliegue en un servicio de Azure con URL accesible.
- Separación de responsabilidades que permita reemplazar piezas (sensor, base de datos, interfaz) sin reescribir el sistema.
- Sin exponer claves ni secretos en el repositorio.

## 4. Alternativas evaluadas

| Alternativa | Por qué no se eligió (o cómo se combinó) |
|---|---|
| **Página estática (lo que partió el proyecto)** | Sin backend no hay persistencia, validaciones server-side ni despliegue con lógica; no cumple el desafío. |
| **Cliente/Servidor simple** | Útil para explicar la comunicación, pero no separa responsabilidades dentro del servidor. |
| **Serverless (Azure Functions)** | Excelente para escalar a costo cero, pero complica la sesión de demostración del flujo MVC completo y el curso lo presenta como alternativa, no como eje. |
| **API + SPA (React/Vue)** | Más moderna, pero duplica el aprendizaje (front + back separados) y complica el despliegue para un MVP de 2 semanas. |
| **MVC + servicios cloud (elegida)** | Mantiene un solo proyecto desplegable, separa claramente Vistas / Controladores / Modelo / Servicios y permite explicar el recorrido completo de una solicitud. |

## 5. Elección: MVC sobre ASP.NET Core + Firebase + Azure App Service

- **MVC (Model-Vista-Controlador)** responde a la necesidad de separar:
  - *Vista*: Razor + JS (`dashboard.js`, `history.js`) — interfaz y gráficos.
  - *Controlador*: `Home`, `Dashboard`, `History`, `Settings` — coordinan cada flujo y validan.
  - *Modelo*: `Reading`, `ThresholdConfig` y `AlertCalculator` — datos y reglas de negocio puras.
  - *Servicios*: `FirebaseService` (persistencia REST) y `DataSimulationService` (simulación del sensor) — aislados tras interfaces.
- **Firebase Realtime Database** aporta persistencia simple y lecturas frecuentes vía API REST,
  sin administrar servidores de base de datos.
- **Azure App Service** es el servicio cloud trabajado en clase para publicar aplicaciones web;
  entrega HTTPS, URL pública y configuración por variables de entorno.

## 6. Ventajas y limitaciones

| Ventajas | Limitaciones |
|---|---|
| Separación clara de responsabilidades; cada pieza es reemplazable por separado. | La base de datos (Firebase) queda fuera de Azure: dos proveedores que gestionar. |
| `AlertCalculator` es lógica pura, testeable sin I/O. | Firebase RTDB con reglas abiertas (demo): falta autenticación (mejora: Firebase Auth). |
| El simulador reproduce el rol del ESP32; cambiar a sensor real no toca el resto del sistema. | Polling de 5 s: no es push real; con muchos usuarios habría que usar SSE/WebSockets o lecturas directas desde el cliente. |
| MVC es el patrón dominante en el ecosistema .NET y fácil de diagramar/defender. | App Service de plan gratuito: CPU limitada y app suspensa tras inactividad (se mitiga con *Always On* en planes de pago). |

## 7. Escalabilidad: ¿de 100 a 10.000 usuarios?

- El tráfico del dashboard haría 17.280 peticiones/usuario/día (cada 5 s). Con 10.000 usuarios
  el cuello de botella sería el backend.
- Opciones: subir el intervalo de polling, servir el JSON desde CDN/caché (la lectura cambia poco),
  migrar a **Azure SignalR o SSE** para push, o dejar que el navegador lea directo de Firebase
  (ya autenticado), descargando el App Service.
- También se escalaría verticalmente (plan App Service superior) y se reemplazaría RTDB por
  **Azure Cosmos DB** si se requieren consultas complejas y SLA empresarial.

## 8. Servicios Azure utilizados

| Servicio | Función |
|---|---|
| App Service (plan gratuito/estudiantes, runtime .NET 10) | Aloja la aplicación MVC y entrega la URL pública. |
| Application Settings (App Service) | Almacena `Firebase__DatabaseUrl` fuera del repositorio. |

Firebase Realtime Database (Google, plan Spark) complementa como persistencia.

## 9. Qué cambiaría ante un nuevo requerimiento

- *Sensor físico*: se elimina `DataSimulationService`; el ESP32 publica en `/readings` (mismo contrato).
- *Varias estaciones*: se agrega `/stations/{id}/readings` y filtros en el dashboard.
- *Usuarios múltiples*: Firebase Auth + reglas por usuario; `SettingsController` deja de ser global.
- *Solo Azure*: se reemplaza `IFirebaseService` por una implementación con Azure SQL/Cosmos —
  el resto del sistema no cambia (detrás de la interfaz `IFirebaseService`).
