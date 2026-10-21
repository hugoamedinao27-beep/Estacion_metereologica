/* =========================================================
   MeteoGuard — Demo estática (GitHub Pages)
   Simulación en el navegador + persistencia híbrida:
   localStorage por defecto, o Firebase RTDB si se configura.
   ========================================================= */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     CONFIGURACIÓN: pegar aquí la URL de Firebase Realtime Database
     para persistir en la nube desde esta demo estática, por ejemplo:
     const FIREBASE_URL = "https://meteoguard-xxxxx-default-rtdb.firebaseio.com";
     Dejarla vacía para usar solo localStorage.
     ------------------------------------------------------------------ */
  var FIREBASE_URL = "";

  var STORAGE_READINGS = "meteoguard_readings";
  var STORAGE_CONFIG = "meteoguard_config";
  var DEFAULT_CONFIG = { coldThreshold: 15, cautionThreshold: 25, calorThreshold: 28, criticalThreshold: 30 };
  var MAX_READINGS = 120;
  var SIM_INTERVAL = 8000;
  var REFRESH_MS = 5000;

  var STATE_INFO = {
    Frio: { label: "Frío", dot: "frio", tag: "cold" },
    Normal: { label: "Normal", dot: "normal", tag: "normal" },
    Precaucion: { label: "Precaución", dot: "precaucion", tag: "warn" },
    Calor: { label: "Calor", dot: "calor", tag: "hot" },
    Critico: { label: "Crítico", dot: "critico", tag: "critical" }
  };

  var sim = { temperature: 22.0, humidity: 54.0 };
  var config = Object.assign({}, DEFAULT_CONFIG);
  var liveChart = null;
  var historyChart = null;

  /* ------------------------- utilidades ------------------------- */

  function firebaseBase() {
    return (FIREBASE_URL || "").trim().replace(/\/+$/, "");
  }

  function useFirebase() {
    return firebaseBase().length > 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function calculateState(temperature, cfg) {
    if (temperature < cfg.coldThreshold) return "Frio";
    if (temperature >= cfg.criticalThreshold) return "Critico";
    if (temperature >= cfg.calorThreshold) return "Calor";
    if (temperature >= cfg.cautionThreshold) return "Precaucion";
    return "Normal";
  }

  function formatTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("es-CL", { hour12: false });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------- persistencia ------------------------- */

  function normalizeConfig(raw) {
    if (!raw || typeof raw !== "object") return Object.assign({}, DEFAULT_CONFIG);
    return {
      coldThreshold: Number(raw.coldThreshold ?? raw.ColdThreshold ?? DEFAULT_CONFIG.coldThreshold),
      cautionThreshold: Number(raw.cautionThreshold ?? raw.CautionThreshold ?? DEFAULT_CONFIG.cautionThreshold),
      calorThreshold: Number(raw.calorThreshold ?? raw.CalorThreshold ?? DEFAULT_CONFIG.calorThreshold),
      criticalThreshold: Number(raw.criticalThreshold ?? raw.CriticalThreshold ?? DEFAULT_CONFIG.criticalThreshold)
    };
  }

  async function loadConfig() {
    if (useFirebase()) {
      try {
        var response = await fetch(firebaseBase() + "/config.json");
        if (response.ok) {
          var data = await response.json();
          if (data) return normalizeConfig(data);
        }
      } catch (error) {
        showModeBanner(true);
      }
    }
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_CONFIG));
      if (stored) return normalizeConfig(stored);
    } catch (error) { /* ignorar */ }
    return Object.assign({}, DEFAULT_CONFIG);
  }

  async function saveConfig(cfg) {
    if (useFirebase()) {
      var response = await fetch(firebaseBase() + "/config.json", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg)
      });
      if (!response.ok) throw new Error("Firebase respondió " + response.status);
    }
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(cfg));
  }

  async function loadReadings(limit) {
    if (useFirebase()) {
      try {
        var response = await fetch(
          firebaseBase() + "/readings.json?orderBy=%22%24key%22&limitToLast=" + limit
        );
        if (response.ok) {
          var data = await response.json();
          if (!data) return [];
          return Object.keys(data).sort().map(function (key) { return data[key]; });
        }
      } catch (error) {
        showModeBanner(true);
      }
      return [];
    }

    var stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_READINGS)) || [];
    } catch (error) { /* ignorar */ }
    return stored.slice(-limit);
  }

  async function pushReading(reading) {
    if (useFirebase()) {
      var key = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var response = await fetch(firebaseBase() + "/readings/" + key + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reading)
      });
      if (!response.ok) throw new Error("Firebase respondió " + response.status);
      return;
    }

    var stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_READINGS)) || [];
    } catch (error) { /* ignorar */ }
    stored.push(reading);
    if (stored.length > MAX_READINGS) stored = stored.slice(-MAX_READINGS);
    localStorage.setItem(STORAGE_READINGS, JSON.stringify(stored));
  }

  /* ------------------------- simulación ------------------------- */

  async function simulateTick() {
    try {
      // Evita duplicados si otra pestaña/visitante ya generó una lectura reciente.
      var latest = await loadReadings(1);
      if (latest.length && Date.now() - Date.parse(latest[0].timestamp) < SIM_INTERVAL + 2000) {
        return;
      }

      sim.temperature = clamp(sim.temperature + (Math.random() - 0.48) * 0.6, 12, 38);
      sim.humidity = clamp(sim.humidity + (Math.random() - 0.5) * 1.5, 30, 85);

      var temperature = Math.round(sim.temperature * 10) / 10;
      var humidity = Math.round(sim.humidity);

      await pushReading({
        temperature: temperature,
        humidity: humidity,
        timestamp: new Date().toISOString(),
        state: calculateState(temperature, config)
      });
    } catch (error) {
      var note = document.getElementById("liveNote");
      if (note) {
        note.hidden = false;
        note.textContent = "No se pudo guardar la lectura (" + error.message + ").";
      }
    }
  }

  /* ------------------------- render ------------------------- */

  function showModeBanner(failed) {
    var banner = document.getElementById("modeBanner");
    if (!banner) return;
    if (useFirebase() && !failed) {
      banner.className = "alert alert-success";
      banner.innerHTML = "Persistencia: <strong>Firebase Realtime Database</strong> (nube).";
    } else if (useFirebase() && failed) {
      banner.className = "alert alert-warning";
      banner.innerHTML = "No se pudo conectar a <strong>Firebase</strong>: se usa almacenamiento local como respaldo.";
    } else {
      banner.className = "alert alert-info";
      banner.innerHTML = "Persistencia: <strong>almacenamiento local del navegador</strong>. Configure <code>FIREBASE_URL</code> en <code>demo/demo.js</code> para usar Firebase.";
    }
  }

  function renderDashboard(latest) {
    var statusText = document.getElementById("statusText");
    var statusDot = document.getElementById("statusDot");
    var tempValue = document.getElementById("tempValue");
    var humValue = document.getElementById("humValue");
    var lastUpdate = document.getElementById("lastUpdate");
    var thresholdPill = document.getElementById("thresholdPill");
    var liveNote = document.getElementById("liveNote");

    if (!latest) {
      statusText.textContent = "Sin datos";
      return;
    }

    var info = STATE_INFO[latest.state] || STATE_INFO.Normal;
    statusText.textContent = info.label;
    statusDot.className = "status-dot status-" + info.dot;
    tempValue.innerHTML = Number(latest.temperature).toFixed(1) + "<small>°C</small>";
    humValue.innerHTML = Math.round(Number(latest.humidity)) + "<small>%</small>";
    lastUpdate.textContent = formatTime(latest.timestamp);
    thresholdPill.textContent = config.calorThreshold + " °C";
    if (liveNote) {
      liveNote.hidden = true;
      liveNote.textContent = "Conectando…";
    }
  }

  function renderLiveChart(readings) {
    var canvas = document.getElementById("liveChart");
    if (!canvas || typeof Chart === "undefined") return;

    var labels = readings.map(function (r) { return formatTime(r.timestamp); });
    var values = readings.map(function (r) { return Number(r.temperature); });

    if (!liveChart) {
      liveChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "Temperatura (°C)",
            data: values,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            y: { suggestedMin: 10, suggestedMax: 40, title: { display: true, text: "°C" } },
            x: { title: { display: true, text: "Hora" } }
          },
          plugins: { legend: { display: false } }
        }
      });
    } else {
      liveChart.data.labels = labels;
      liveChart.data.datasets[0].data = values;
      liveChart.update();
    }
  }

  function renderHistory(readings) {
    var empty = document.getElementById("historyEmpty");
    var body = document.getElementById("historyBody");
    var canvas = document.getElementById("historyChart");

    if (empty) empty.hidden = readings.length > 0;
    if (!body) return;

    if (readings.length === 0) {
      body.innerHTML = '<tr><td colspan="4">Sin datos todavía…</td></tr>';
    } else {
      body.innerHTML = readings.slice().reverse().map(function (r) {
        var info = STATE_INFO[r.state] || STATE_INFO.Normal;
        return "<tr>" +
          "<td>" + escapeHtml(formatTime(r.timestamp)) + "</td>" +
          "<td>" + Number(r.temperature).toFixed(1) + " °C</td>" +
          "<td>" + Math.round(Number(r.humidity)) + " %</td>" +
          '<td><span class="tag tag-' + info.tag + '">' + info.label + "</span></td>" +
          "</tr>";
      }).join("");
    }

    if (!canvas || typeof Chart === "undefined" || readings.length === 0) return;

    var labels = readings.map(function (r) { return formatTime(r.timestamp); });
    var temperatures = readings.map(function (r) { return Number(r.temperature); });
    var humidities = readings.map(function (r) { return Number(r.humidity); });

    if (!historyChart) {
      historyChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Temperatura (°C)",
              data: temperatures,
              borderColor: "#2563eb",
              backgroundColor: "rgba(37, 99, 235, 0.10)",
              tension: 0.3,
              pointRadius: 2,
              yAxisID: "y"
            },
            {
              label: "Humedad (%)",
              data: humidities,
              borderColor: "#16a34a",
              backgroundColor: "rgba(22, 163, 74, 0.10)",
              tension: 0.3,
              pointRadius: 2,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            y: { position: "left", title: { display: true, text: "°C" } },
            y1: {
              position: "right",
              title: { display: true, text: "%" },
              grid: { drawOnChartArea: false }
            },
            x: { title: { display: true, text: "Hora" } }
          },
          plugins: { legend: { position: "bottom" } }
        }
      });
    } else {
      historyChart.data.labels = labels;
      historyChart.data.datasets[0].data = temperatures;
      historyChart.data.datasets[1].data = humidities;
      historyChart.update();
    }
  }

  async function refresh() {
    var readings = await loadReadings(MAX_READINGS);
    renderDashboard(readings[readings.length - 1]);
    renderLiveChart(readings.slice(-30));
    renderHistory(readings.slice(-5));
  }

  /* ------------------------- formulario ------------------------- */

  function fillForm() {
    document.getElementById("coldThreshold").value = config.coldThreshold;
    document.getElementById("cautionThreshold").value = config.cautionThreshold;
    document.getElementById("calorThreshold").value = config.calorThreshold;
    document.getElementById("criticalThreshold").value = config.criticalThreshold;
  }

  function setFieldError(field, message) {
    var input = document.getElementById(field);
    var error = document.getElementById(field + "Error");
    if (error) error.textContent = message;
    if (input) input.classList.toggle("input-validation-error", Boolean(message));
  }

  function showSettingsMessage(type, text) {
    var box = document.getElementById("settingsMessage");
    if (!box) return;
    box.hidden = false;
    box.className = "alert alert-" + type;
    box.textContent = text;
  }

  function validateForm(values) {
    var errors = {};
    var ranges = {
      coldThreshold: [0, 40, "El umbral de frío debe estar entre 0 °C y 40 °C."],
      cautionThreshold: [1, 50, "El umbral de precaución debe estar entre 1 °C y 50 °C."],
      calorThreshold: [2, 60, "El umbral de calor debe estar entre 2 °C y 60 °C."],
      criticalThreshold: [3, 65, "El umbral crítico debe estar entre 3 °C y 65 °C."]
    };

    Object.keys(ranges).forEach(function (field) {
      var value = values[field];
      var rule = ranges[field];
      if (value === "" || isNaN(value)) {
        errors[field] = "Debe ingresar un número.";
      } else if (value < rule[0] || value > rule[1]) {
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

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    var values = {
      coldThreshold: Number(document.getElementById("coldThreshold").value),
      cautionThreshold: Number(document.getElementById("cautionThreshold").value),
      calorThreshold: Number(document.getElementById("calorThreshold").value),
      criticalThreshold: Number(document.getElementById("criticalThreshold").value)
    };

    ["coldThreshold", "cautionThreshold", "calorThreshold", "criticalThreshold"].forEach(function (field) {
      setFieldError(field, "");
    });

    var errors = validateForm(values);
    if (Object.keys(errors).length > 0) {
      Object.keys(errors).forEach(function (field) { setFieldError(field, errors[field]); });
      showSettingsMessage("error", "Revise los errores: los umbrales no son válidos.");
      return;
    }

    try {
      await saveConfig(values);
      config = Object.assign({}, values);
      showSettingsMessage("success", "Umbrales guardados correctamente. Las próximas lecturas usarán esta configuración.");
      await refresh();
    } catch (error) {
      showSettingsMessage("error", "No fue posible guardar: " + error.message);
    }
  }

  /* ------------------------- inicio ------------------------- */

  async function init() {
    showModeBanner(false);
    config = await loadConfig();
    fillForm();

    document.getElementById("settingsForm").addEventListener("submit", handleSubmit);

    await refresh();
    await simulateTick();
    await refresh();

    setInterval(simulateTick, SIM_INTERVAL);
    setInterval(refresh, REFRESH_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
