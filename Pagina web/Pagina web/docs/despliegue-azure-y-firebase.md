# Guía: Firebase + despliegue en Azure App Service

Paso a paso para crear las cuentas, configurar la base de datos y publicar la aplicación.

---

## Parte A — Firebase Realtime Database (gratis)

1. Entrar a <https://console.firebase.google.com> con una cuenta Google y aceptar términos.
2. **Crear proyecto** → nombre sugerido: `meteoguard` → desactivar Google Analytics si se quiere → *Create project*.
3. En el panel del proyecto: **Build → Realtime Database → Create Database**.
   - Elegir ubicación más cercana (p. ej. `southamerica-east1` o `us-central`).
   - Empezar en **test mode** (reglas abiertas; suficiente para el MVP — se documenta como limitación).
4. Copiar la URL del database, con esta forma:
   `https://meteoguard-xxxxx-default-rtdb.firebaseio.com`
5. Pegarla en local en `appsettings.json`:

   ```json
   "Firebase": {
     "DatabaseUrl": "https://meteoguard-xxxxx-default-rtdb.firebaseio.com"
   }
   ```

6. Ejecutar `dotnet run`, abrir el Dashboard y verificar que aparecen lecturas cada pocos
   segundos (el simulador las escribe). En la consola de Firebase → *Realtime Database* deben
   verse los nodos `/readings` y `/config`.

**Estructura de datos generada:**

```
meteoguard-xxxxx-default-rtdb.firebaseio.com/
├── config:    { ColdThreshold: 15, CautionThreshold: 25, CalorThreshold: 28, CriticalThreshold: 30 }
└── readings/
    └── 1761012345678-a1b2c3: { temperature: 22.4, humidity: 54, timestamp: "...", state: "Normal" }
```

> En la defensa pueden mostrar reglas actuales de *test mode* y explicar que la mejora es
> Firebase Auth + reglas por usuario.

---

## Parte B — Azure App Service (cuenta estudiante)

### B.1 Crear la cuenta

1. Entrar a <https://portal.azure.com> → **Crear un recurso → Suscripciones**.
   Con correo institucional, buscar **Azure for Students** (crédito sin tarjeta).
2. Si la universidad entrega una cuenta ya creada, usar esas credenciales (consultar al docente).

### B.2 Crear el App Service

1. Portal → **Crear un recurso → Web → App Service**:
   - **Nombre**: `meteoguard-web` (queda como URL `meteoguard-web.azurewebsites.net`).
   - **Runtime stack**: **.NET 10 (LTS)** · **Operating System**: Windows · **Region**: la más cercana.
   - **Pricing plan**: *Free (F1)* si está disponible; si no, *Basic B1* (costo bajo).
2. **Revisar + crear** → **Crear**. Esperar ~2 minutos.

### B.3 Configurar la variable de Firebase (sin exponer secretos)

1. En el App Service → **Configuración → Application settings → New application setting**:
   - Name: `Firebase__DatabaseUrl`
   - Value: `https://meteoguard-xxxxx-default-rtdb.firebaseio.com`
2. **Save**. El repositorio NUNCA contiene esta URL con credenciales; solo vive en Azure.

### B.4 Publicar la aplicación

Opción recomendada — **zip deploy desde la línea de comandos** (con Azure CLI instalado o desde Cloud Shell del portal):

```bash
# 1. Empaquetar el proyecto publicado
dotnet publish -c Release -o publish
# Comprimir el contenido de la carpeta publish en deploy.zip

# 2. Autenticarse y desplegar (nombres según su suscripción)
az login
az webapp deploy --resource-group <grupo> --name meteoguard-web \
  --src-path deploy.zip --type zip
```

Alternativa visual: Visual Studio → clic derecho en el proyecto → **Publish → Azure → App Service (Linux/Windows) → Finish**.

### B.5 Verificar

1. Abrir `https://meteoguard-web.azurewebsites.net`.
2. Dashboard: debe mostrar lecturas nuevas cada ~8 s (el simulador corre dentro de la app publicada).
3. Configuración: cambiar un umbral → mensaje de éxito → verificar en la consola de Firebase que `/config` cambió.
4. Historial: tabla y gráfico con datos reales de Firebase.

> Si el plan es gratuito y la app queda inactiva, la primera petición tarda ~20 s en despertarla.
> Para la demo, abrir la URL unos minutos antes de presentar o usar *Always On* (planes de pago).

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Dashboard dice "Firebase no está configurado" | Falta la variable de entorno | Revisar `Firebase__DatabaseUrl` en Application Settings y reiniciar la app |
| 500 en todas las páginas | Runtime no coincide | Verificar que el App Service fue creado con .NET 10 |
| Sin lecturas nuevas | Simulador no corre / URL mal copiada | Logs del App Service → *Log stream*; probar la URL `{firebase}/readings.json?limitToLast=1` en el navegador |
| Firebase 401/permiso | Reglas de la BD | Consola Firebase → Rules → test mode |
