/* ==========================================================================
   PetSafe IoT — Firmware del ESP32  (ESP32 + sensor DHT22 + relé del ventilador)
   --------------------------------------------------------------------------
   Placa de pruebas: cualquier ESP32 DevKit con DHT22 en GPIO4 y el relé del
   ventilador en GPIO5. Activa el relé con LOW (módulos relé "active low").

   MONITOR SERIAL (115200 baudios, JSON por línea):
     {"id":"ESP32-PETSAFE-01","t":26.3,"h":55,"fan":1,"auto":1,"rssi":-58}

   ORDENES QUE RECIBE DE LA APP:
     {"cmd":"fan","on":1}      enciende / apaga el ventilador
     {"cmd":"auto","on":1}     activa / desactiva el control automático
     {"cmd":"limits","cold":20,"hot":27,"crit":28}
   ========================================================================== */

#include <Arduino.h>
#include <WiFi.h>
#include <DHT.h>

// ──────────────────── CONFIGURACIÓN ────────────────────
static const char* WIFI_SSID   = "TU_RED_WIFI";
static const char* WIFI_PASS   = "TU_CLAVE";

static const uint8_t PIN_DHT   = 4;    // datos del DHT22
static const uint8_t PIN_RELE  = 5;    // relé del ventilador (active LOW)
static const uint8_t LED_PIN   = 2;

static const char* DEVICE_ID  = "ESP32-PETSAFE-01";

// Umbrales del sistema de estados (la app puede sobrescribirlos)
static float LIM_COLD = 20.0f;   // <= 20 °C  -> FRÍO
static float LIM_HOT  = 27.0f;   // >= 27 °C  -> CALOR
static float LIM_CRIT = 28.0f;   // >= 28 °C  -> CRÍTICO

static bool AUTO_CONTROL = true; // control automático independiente del móvil
static bool FAN_ON       = false;

// ──────────────────── OBJETOS ────────────────────
DHT    dht(PIN_DHT, DHT22);
String bufferSerial = "";

// ──────────────────── UTILIDADES ────────────────────
const char* estado(float t) {
  if (t <= LIM_COLD) return "FRIO";
  if (t >= LIM_CRIT) return "CRITICO";
  if (t >= LIM_HOT)  return "CALOR";
  return "NORMAL";
}

void setFan(bool on) {
  FAN_ON = on;
  digitalWrite(PIN_RELE, on ? LOW : HIGH);   // active LOW
  Serial.printf("[ACTUADOR] Ventilador %s\n", on ? "ON" : "OFF");
}

void publicar(float t, float h) {
  Serial.print("{\"id\":\"");
  Serial.print(DEVICE_ID);
  Serial.printf("\",\"t\":%.1f,\"h\":%.0f,\"fan\":%d,\"auto\":%d,\"rssi\":%d}\n",
                t, h, FAN_ON ? 1 : 0, AUTO_CONTROL ? 1 : 0, WiFi.RSSI());
}

// ──────────────────── ÓRDENES ────────────────────
void procesarOrden(String json) {
  // extracción simple de claves (formato fijo del protocolo)
  int i;

  i = json.indexOf("\"fan\"");
  if (i >= 0) {
    int c = json.indexOf(':', i);
    bool on = json.substring(c + 1).trim() == "1" ||
              json.substring(c + 1).trim().substring(0, 1) == "1";
    setFan(on);
    return;
  }

  i = json.indexOf("\"auto\"");
  if (i >= 0) {
    int c = json.indexOf(':', i);
    AUTO_CONTROL = json.substring(c + 1).trim().substring(0, 1) == "1";
    Serial.printf("[CONFIG] Control automático %s\n", AUTO_CONTROL ? "ON" : "OFF");
    return;
  }

  i = json.indexOf("\"cold\"");
  if (i >= 0) {
    int c = json.indexOf(':', i);
    LIM_COLD = json.substring(c + 1).toFloat();
    i = json.indexOf("\"hot\"");
    if (i >= 0) { c = json.indexOf(':', i); LIM_HOT = json.substring(c + 1).toFloat(); }
    i = json.indexOf("\"crit\"");
    if (i >= 0) { c = json.indexOf(':', i); LIM_CRIT = json.substring(c + 1).toFloat(); }
    Serial.printf("[CONFIG] Límites -> frío<=%.1f calor>=%.1f crítico>=%.1f\n",
                  LIM_COLD, LIM_HOT, LIM_CRIT);
  }
}

// ──────────────────── SETUP ────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== PetSafe IoT · ESP32 ===");

  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, HIGH);   // ventilador apagado
  pinMode(LED_PIN, OUTPUT);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Conectando a Wi-Fi");
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(250);
    Serial.print(".");
    intentos++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nIP: %s\nRSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\nSin Wi-Fi: el control automático sigue funcionando.");
  }
}

// ──────────────────── BUCLE ────────────────────
void loop() {

  // --- lectura del sensor (cada 5 s) ---
  static unsigned long ultima = 0;
  if (millis() - ultima >= 5000) {
    ultima = millis();

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("{\"err\":\"fallo de lectura DHT22\"}");
    } else {
      const char* st = estado(t);
      Serial.printf("[LECTURA] %.1f °C · %.0f %% · %s\n", t, h, st);

      // CONTROL AUTOMÁTICO: no depende del teléfono
      if (AUTO_CONTROL) {
        bool debe = (t >= LIM_HOT);
        if (debe != FAN_ON) setFan(debe);
      }

      // LED: parpadeo rápido en crítico, lento en calor
      digitalWrite(LED_PIN,
        strcmp(st, "CRITICO") == 0 ? (millis() % 200 < 100) :
        strcmp(st, "CALOR")   == 0 ? (millis() % 600 < 300) : 0);

      publicar(t, h);
    }
  }

  // --- recepción de órdenes de la app ---
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      bufferSerial.trim();
      if (bufferSerial.length() > 0 && bufferSerial.startsWith("{")) {
        procesarOrden(bufferSerial);
      }
      bufferSerial = "";
    } else if (bufferSerial.length() < 200) {
      bufferSerial += c;
    }
  }
}