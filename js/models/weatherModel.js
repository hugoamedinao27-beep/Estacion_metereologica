/* =========================================================
   MeteoGuard — CAPA DE MODELO (weatherModel.js)
   ========================================================= */

window.MeteoGuard = window.MeteoGuard || {};

window.MeteoGuard.Model = (function () {
  "use strict";

  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

  var STORAGE_KEYS = {
    READINGS: "meteoguard_readings_v2",
    CONFIG: "meteoguard_config_v2",
    LAST_CITY: "meteoguard_last_city",
    GEO_CLIMA: "meteoguard_geo_clima",
    THEME: "meteoguard_theme"
  };

  var DEFAULT_CONFIG = {
    coldThreshold: 15,
    cautionThreshold: 25,
    calorThreshold: 28,
    criticalThreshold: 30
  };

  var MAX_READINGS = 120;
  var SIM_INTERVAL = 8000;

  var STATE_INFO = {
    Frio: { label: "Frío", dot: "frio", tag: "cold", cardClass: "state-card-frio" },
    Normal: { label: "Normal", dot: "normal", tag: "normal", cardClass: "state-card-normal" },
    Precaucion: { label: "Precaución", dot: "precaucion", tag: "warn", cardClass: "state-card-precaucion" },
    Calor: { label: "Calor", dot: "calor", tag: "hot", cardClass: "state-card-calor" },
    Critico: { label: "Crítico", dot: "critico", tag: "critical", cardClass: "state-card-critico" }
  };

  var WEATHER_MAP = [
    { codes: [0], icon: "☀️", text: "Cielo despejado", theme: "clear", badge: "☀️ Día Soleado / Despejado" },
    { codes: [1, 2], icon: "🌤️", text: "Parcialmente nublado", theme: "clear", badge: "🌤️ Templado / Nubes dispersas" },
    { codes: [3], icon: "☁️", text: "Mayormente nublado", theme: "cloudy", badge: "☁️ Cielo Cubierto" },
    { codes: [45, 48], icon: "🌫️", text: "Niebla o bruma", theme: "cloudy", badge: "🌫️ Neblina Densa" },
    { codes: [51, 53, 55, 56, 57], icon: "🌦️", text: "Llovizna", theme: "rain", badge: "🌦️ Precipitación Ligera" },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], icon: "🌧️", text: "Lluvia", theme: "rain", badge: "🌧️ Frente de Lluvia Activo" },
    { codes: [71, 73, 75, 77, 85, 86], icon: "❄️", text: "Nieve", theme: "snow", badge: "❄️ Condición Invernal" },
    { codes: [95, 96, 99], icon: "⛈️", text: "Tormenta eléctrica", theme: "storm", badge: "⛈️ Actividad Eléctrica" }
  ];

  var simState = { temperature: 22.0, humidity: 54.0 };
  var currentConfig = Object.assign({}, DEFAULT_CONFIG);
  var readingsMemory = [];
  var isInitialized = false;

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function safeGetStorage(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSetStorage(key, valueString) {
    try { window.localStorage.setItem(key, valueString); } catch (e) {}
  }

  function isUsingFirebase() { return false; }

  function getSavedTheme() {
    return safeGetStorage(STORAGE_KEYS.THEME) || "dark";
  }

  function saveTheme(theme) {
    safeSetStorage(STORAGE_KEYS.THEME, theme);
  }

  function calculateState(temperature, cfg) {
    var c = cfg || currentConfig;
    if (temperature < c.coldThreshold) return "Frio";
    if (temperature >= c.criticalThreshold) return "Critico";
    if (temperature >= c.calorThreshold) return "Calor";
    if (temperature >= c.cautionThreshold) return "Precaucion";
    return "Normal";
  }

  function getStateMetadata(stateKey) {
    return STATE_INFO[stateKey] || STATE_INFO.Normal;
  }

  function getWeatherMetadata(code) {
    var c = Number(code);
    for (var i = 0; i < WEATHER_MAP.length; i++) {
      if (WEATHER_MAP[i].codes.indexOf(c) !== -1) return WEATHER_MAP[i];
    }
    return { icon: "🌡️", text: "Condiciones variables", theme: "cloudy", badge: "🌡️ Clima Variable" };
  }

  function calculateGauges(reading, cfg) {
    var c = cfg || currentConfig;
    if (!reading) return { tempPercent: 0, humPercent: 0, tempRatioText: "Sin datos" };

    var temp = Number(reading.temperature);
    var hum = clamp(Math.round(Number(reading.humidity)), 0, 100);
    var tempPercent = clamp(Math.round((temp / c.criticalThreshold) * 100), 5, 100);
    var tempRatioText = tempPercent + "% del umbral crítico (" + c.criticalThreshold + "°C)";

    return { tempPercent: tempPercent, humPercent: hum, tempRatioText: tempRatioText };
  }

  function calculateKPIs(readings) {
    if (!readings || readings.length === 0) {
      return { maxTemp: "-- °C", minTemp: "-- °C", avgHum: "-- %", comfort: "Sin datos", comfortSub: "Esperando lecturas" };
    }

    var maxT = -Infinity;
    var minT = Infinity;
    var sumHum = 0;

    for (var i = 0; i < readings.length; i++) {
      var t = Number(readings[i].temperature);
      var h = Number(readings[i].humidity);
      if (t > maxT) maxT = t;
      if (t < minT) minT = t;
      sumHum += h;
    }

    var avgH = Math.round(sumHum / readings.length);
    var latest = readings[readings.length - 1];
    var curT = Number(latest.temperature);
    var curH = Number(latest.humidity);

    var comfort = "Ambiente Óptimo";
    var comfortSub = "Equilibrio térmico ideal";

    if (curT < currentConfig.coldThreshold) {
      comfort = curH > 70 ? "Frío Húmedo" : "Ambiente Frío";
      comfortSub = "Bajo umbral de frío";
    } else if (curT >= currentConfig.criticalThreshold) {
      comfort = "Estrés Térmico";
      comfortSub = "Alerta crítica activa";
    } else if (curT >= currentConfig.cautionThreshold) {
      comfort = curH > 65 ? "Calor Húmedo" : "Cálido Seco";
      comfortSub = "Sensación térmica elevada";
    } else if (curH > 75) {
      comfort = "Humedad Alta";
      comfortSub = "Aire muy húmedo";
    } else if (curH < 35) {
      comfort = "Aire Seco";
      comfortSub = "Baja saturación";
    }

    return { maxTemp: maxT.toFixed(1) + " °C", minTemp: minT.toFixed(1) + " °C", avgHum: avgH + " %", comfort: comfort, comfortSub: comfortSub };
  }

  function validateThresholds(values) {
    var errors = {};
    var ranges = {
      coldThreshold: [0, 40, "El umbral de frío debe estar entre 0 °C y 40 °C."],
      cautionThreshold: [1, 50, "El umbral de precaución debe estar entre 1 °C y 50 °C."],
      calorThreshold: [2, 60, "El umbral de calor debe estar entre 2 °C y 60 °C."],
      criticalThreshold: [3, 65, "El umbral crítico debe estar entre 3 °C y 65 °C."]
    };

    Object.keys(ranges).forEach(function (field) {
      var val = values[field];
      var rule = ranges[field];
      if (val === "" || isNaN(val)) {
        errors[field] = "Debe ingresar un número.";
      } else if (val < rule[0] || val > rule[1]) {
        errors[field] = rule[2];
      }
    });

    if (!errors.cautionThreshold && values.cautionThreshold <= values.coldThreshold) {
      errors.cautionThreshold = "El umbral de precaución debe ser mayor que el umbral de frío.";
    }
    if (!errors.calorThreshold && values.calorThreshold <= values.cautionThreshold) {
      errors.calorThreshold = "El umbral de calor debe ser mayor que el umbral de precaución.";
    }
    if (!errors.criticalThreshold && values.criticalThreshold <= values.calorThreshold) {
      errors.criticalThreshold = "El umbral crítico debe ser mayor que el umbral de calor.";
    }

    return { isValid: Object.keys(errors).length === 0, errors: errors };
  }

  function normalizeConfig(raw) {
    if (!raw || typeof raw !== "object") return Object.assign({}, DEFAULT_CONFIG);
    return {
      coldThreshold: Number(raw.coldThreshold ?? DEFAULT_CONFIG.coldThreshold),
      cautionThreshold: Number(raw.cautionThreshold ?? DEFAULT_CONFIG.cautionThreshold),
      calorThreshold: Number(raw.calorThreshold ?? DEFAULT_CONFIG.calorThreshold),
      criticalThreshold: Number(raw.criticalThreshold ?? DEFAULT_CONFIG.criticalThreshold)
    };
  }

  async function loadConfig() {
    var raw = safeGetStorage(STORAGE_KEYS.CONFIG);
    if (raw) {
      try { currentConfig = normalizeConfig(JSON.parse(raw)); } catch (e) {}
    }
    return Object.assign({}, currentConfig);
  }

  async function saveConfig(cfg) {
    currentConfig = normalizeConfig(cfg);
    for (var i = 0; i < readingsMemory.length; i++) {
      readingsMemory[i].state = calculateState(Number(readingsMemory[i].temperature), currentConfig);
    }
    safeSetStorage(STORAGE_KEYS.CONFIG, JSON.stringify(currentConfig));
    safeSetStorage(STORAGE_KEYS.READINGS, JSON.stringify(readingsMemory));
    return Object.assign({}, currentConfig);
  }

  function getCurrentConfig() { return Object.assign({}, currentConfig); }

  async function loadReadings(limit) {
    var max = limit || MAX_READINGS;
    if (!isInitialized) {
      isInitialized = true;
      var raw = safeGetStorage(STORAGE_KEYS.READINGS);
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            readingsMemory = parsed.slice(-MAX_READINGS);
            var last = readingsMemory[readingsMemory.length - 1];
            simState.temperature = Number(last.temperature) || 22.0;
            simState.humidity = Number(last.humidity) || 54.0;
          }
        } catch (e) {}
      }
    }
    return readingsMemory.slice(-max);
  }

  async function simulateTick(forcedTemp, forcedHum) {
    if (!isInitialized) { await loadReadings(MAX_READINGS); }

    if (typeof forcedTemp === "number") {
      simState.temperature = clamp(forcedTemp, 0, 55);
      if (typeof forcedHum === "number") {
        simState.humidity = clamp(forcedHum, 15, 98);
      }
    } else {
      simState.temperature = clamp(simState.temperature + (Math.random() - 0.48) * 1.1, 11, 37);
      simState.humidity = clamp(simState.humidity + (Math.random() - 0.5) * 2.5, 30, 88);
    }

    var temperature = Math.round(simState.temperature * 10) / 10;
    var humidity = Math.round(simState.humidity);

    var newReading = {
      temperature: temperature,
      humidity: humidity,
      timestamp: new Date().toISOString(),
      state: calculateState(temperature, currentConfig)
    };

    readingsMemory.push(newReading);
    if (readingsMemory.length > MAX_READINGS) {
      readingsMemory = readingsMemory.slice(-MAX_READINGS);
    }

    safeSetStorage(STORAGE_KEYS.READINGS, JSON.stringify(readingsMemory));
    return newReading;
  }

  async function fetchCityWeather(cityQuery) {
    var geoUrl = GEOCODE_URL + "?name=" + encodeURIComponent(cityQuery) + "&count=1&language=es&format=json";
    var geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("No se pudo buscar la ciudad");
    var geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) throw new Error("NOT_FOUND");

    var place = geoData.results[0];
    var params = [
      "latitude=" + place.latitude,
      "longitude=" + place.longitude,
      "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      "timezone=auto",
      "forecast_days=6"
    ];
    var wxRes = await fetch(FORECAST_URL + "?" + params.join("&"));
    if (!wxRes.ok) throw new Error("No se pudo obtener el pronóstico");
    var wxData = await wxRes.json();

    var fullName = place.name + (place.country ? ", " + place.country : "");
    safeSetStorage(STORAGE_KEYS.LAST_CITY, fullName);

    return { locationName: fullName, current: wxData.current, daily: wxData.daily };
  }

  function getLastSearchedCity() {
    return safeGetStorage(STORAGE_KEYS.LAST_CITY) || "Puerto Montt, Chile";
  }

  async function fetchWeatherByCoords(lat, lng) {
    var placeName = lat.toFixed(3) + ", " + lng.toFixed(3);
    try {
      var nomUrl = NOMINATIM_URL + "?format=json&lat=" + lat + "&lon=" + lng + "&zoom=18&addressdetails=1&accept-language=es";
      var nomRes = await fetch(nomUrl, { headers: { "Accept": "application/json" } });
      if (nomRes.ok) {
        var j = await nomRes.json();
        var a = j.address || {};
        var p = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || (j.display_name || "").split(",")[0];
        if (p) placeName = p + (a.country ? ", " + a.country : "");
      }
    } catch (e) {}

    var wxUrl = FORECAST_URL + "?latitude=" + lat + "&longitude=" + lng +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto";
    var wxRes = await fetch(wxUrl);
    if (!wxRes.ok) throw new Error("Error al obtener clima GPS");
    var wxJson = await wxRes.json();
    var cur = wxJson.current;

    var data = {
      place: placeName,
      temp: cur.temperature_2m,
      feels: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      code: cur.weather_code,
      updated: Date.now()
    };

    safeSetStorage(STORAGE_KEYS.GEO_CLIMA, JSON.stringify(data));
    return data;
  }

  function getCachedGeoWeather() {
    var raw = safeGetStorage(STORAGE_KEYS.GEO_CLIMA);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  return {
    SIM_INTERVAL: SIM_INTERVAL,
    isUsingFirebase: isUsingFirebase,
    getSavedTheme: getSavedTheme,
    saveTheme: saveTheme,
    getStateMetadata: getStateMetadata,
    getWeatherMetadata: getWeatherMetadata,
    calculateGauges: calculateGauges,
    calculateKPIs: calculateKPIs,
    validateThresholds: validateThresholds,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    getCurrentConfig: getCurrentConfig,
    loadReadings: loadReadings,
    simulateTick: simulateTick,
    fetchCityWeather: fetchCityWeather,
    getLastSearchedCity: getLastSearchedCity,
    fetchWeatherByCoords: fetchWeatherByCoords,
    getCachedGeoWeather: getCachedGeoWeather
  };
})();