/* =========================================================
   MeteoGuard — CAPA DE VISTA (weatherView.js)
   ========================================================= */

window.MeteoGuard = window.MeteoGuard || {};

window.MeteoGuard.View = (function () {
  "use strict";

  var liveChart = null;
  var historyChart = null;
  var geoUpdated = null;

  function renderChartSafely(canvasId, render) {
    var message = document.getElementById(canvasId + "Message");
    try {
      if (typeof Chart === "undefined") throw new Error("Chart.js no está disponible");
      render();
      if (message) message.hidden = true;
    } catch (error) {
      if (message) {
        message.textContent = "Gráfico no disponible. Las lecturas y la tabla siguen actualizándose. Recarga la página para reintentar.";
        message.hidden = false;
      }
    }
  }

  function formatTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("es-CL", { hour12: false });
  }

  function formatDay(iso) {
    var date = new Date(iso + "T00:00:00");
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "2-digit" });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var icon = document.getElementById("themeIcon");
    var label = document.getElementById("themeLabel");

    if (theme === "dark") {
      if (icon) icon.textContent = "☀️";
      if (label) label.textContent = "Modo Claro";
    } else {
      if (icon) icon.textContent = "🌙";
      if (label) label.textContent = "Modo Oscuro";
    }
    updateChartsTheme(theme);
  }

  function applyChartTheme(chart, theme) {
    var textColor = theme === "dark" ? "#94a3b8" : "#64748b";
    var gridColor = theme === "dark" ? "rgba(148, 163, 184, 0.14)" : "rgba(15, 23, 42, 0.08)";

    Object.keys(chart.options.scales).forEach(function (axisKey) {
      var scale = chart.options.scales[axisKey];
      // No reasignar el objeto resuelto por Chart.js a su propia propiedad.
      if (!scale.ticks) scale.ticks = {};
      scale.ticks.color = textColor;
      if (scale.title) scale.title.color = textColor;
      if (scale.grid && scale.grid.drawOnChartArea !== false) {
        scale.grid.color = gridColor;
      }
    });
    if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
      chart.options.plugins.legend.labels.color = textColor;
    }
    chart.update();
  }

  function updateChartsTheme(theme) {
    [liveChart, historyChart].forEach(function (chart) {
      if (!chart) return;
      renderChartSafely(chart.canvas.id, function () {
        applyChartTheme(chart, theme);
      });
    });
  }

  function renderModeBanner(useFirebase, failed, recovered) {
    var banner = document.getElementById("modeBanner");
    if (!banner) return;
    if (failed) {
      banner.className = "alert alert-warning";
      banner.textContent = "No se pudieron guardar algunos datos en este navegador. Las lecturas continúan en memoria y podrían perderse al cerrar la página.";
    } else if (useFirebase) {
      banner.className = "alert alert-success";
      banner.innerHTML = "Persistencia: <strong>Firebase Realtime Database</strong> (nube).";
    } else {
      banner.className = "alert alert-info";
      banner.innerHTML = "Modo de persistencia: <strong>almacenamiento local del navegador</strong>.";
    }
    if (recovered) banner.innerHTML += " Se detectaron datos guardados inválidos: se recuperaron los valores válidos y se restableció la configuración cuando fue necesario.";
  }

  function renderDashboard(latest, cfg, stateMeta, gauges, kpis) {
    var statusCard = document.getElementById("statusCard");
    var statusText = document.getElementById("statusText");
    var statusDot = document.getElementById("statusDot");
    var tempValue = document.getElementById("tempValue");
    var humValue = document.getElementById("humValue");
    var tempGaugeFill = document.getElementById("tempGaugeFill");
    var tempGaugeLabel = document.getElementById("tempGaugeLabel");
    var humGaugeFill = document.getElementById("humGaugeFill");
    var humGaugeLabel = document.getElementById("humGaugeLabel");
    var lastUpdate = document.getElementById("lastUpdate");
    var thresholdPill = document.getElementById("thresholdPill");
    var criticalPill = document.getElementById("criticalPill");

    if (latest) {
      if (statusCard) statusCard.className = "hero-card " + stateMeta.cardClass;
      statusText.textContent = stateMeta.label;
      statusDot.className = "status-dot status-" + stateMeta.dot;
      tempValue.innerHTML = Number(latest.temperature).toFixed(1) + "<small>°C</small>";
      humValue.innerHTML = Math.round(Number(latest.humidity)) + "<small>%</small>";
      lastUpdate.textContent = formatTime(latest.timestamp);
      thresholdPill.textContent = cfg.calorThreshold + " °C";
      if (criticalPill) criticalPill.textContent = cfg.criticalThreshold + " °C";

      if (tempGaugeFill) tempGaugeFill.style.width = gauges.tempPercent + "%";
      if (tempGaugeLabel) tempGaugeLabel.textContent = gauges.tempRatioText;
      if (humGaugeFill) humGaugeFill.style.width = gauges.humPercent + "%";
      if (humGaugeLabel) humGaugeLabel.textContent = gauges.humPercent + "% de saturación";
    }

    if (kpis) {
      document.getElementById("kpiMaxTemp").textContent = kpis.maxTemp;
      document.getElementById("kpiMinTemp").textContent = kpis.minTemp;
      document.getElementById("kpiAvgHum").textContent = kpis.avgHum;
      document.getElementById("kpiComfort").textContent = kpis.comfort;
      document.getElementById("kpiComfortSub").textContent = kpis.comfortSub;
    }
  }

  function renderLiveChart(readings) {
    var canvas = document.getElementById("liveChart");
    if (!canvas) return;

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
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.16)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: "#f97316"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            y: { suggestedMin: 10, suggestedMax: 38, title: { display: true, text: "°C" } },
            x: { title: { display: true, text: "Hora" } }
          },
          plugins: { legend: { display: false } }
        }
      });
      applyChartTheme(liveChart, document.documentElement.getAttribute("data-theme") || "dark");
    } else {
      liveChart.data.labels = labels;
      liveChart.data.datasets[0].data = values;
      liveChart.update();
    }
  }

  function renderHistory(readings, getStateMetaFn) {
    var empty = document.getElementById("historyEmpty");
    var body = document.getElementById("historyBody");
    var canvas = document.getElementById("historyChart");

    if (empty) empty.hidden = readings.length > 0;
    if (!body) return;

    var lastFive = readings.slice(-5).reverse();
    if (lastFive.length === 0) {
      body.innerHTML = '<tr><td colspan="4">Sin datos todavía…</td></tr>';
    } else {
      body.innerHTML = lastFive.map(function (r) {
        var info = getStateMetaFn(r.state);
        return "<tr>" +
          "<td>" + escapeHtml(formatTime(r.timestamp)) + "</td>" +
          "<td>" + Number(r.temperature).toFixed(1) + " °C</td>" +
          "<td>" + Math.round(Number(r.humidity)) + " %</td>" +
          '<td><span class="tag tag-' + info.tag + '">' + info.label + "</span></td>" +
          "</tr>";
      }).join("");
    }

    if (!canvas || readings.length === 0) return;

    renderChartSafely("historyChart", function () {
      renderHistoryChart(canvas, readings);
    });
  }

  function renderHistoryChart(canvas, readings) {
    var recent = readings.slice(-15);
    var labels = recent.map(function (r) { return formatTime(r.timestamp); });
    var temperatures = recent.map(function (r) { return Number(r.temperature); });
    var humidities = recent.map(function (r) { return Number(r.humidity); });

    if (!historyChart) {
      historyChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Temperatura (°C)",
              data: temperatures,
              borderColor: "#f97316",
              backgroundColor: "rgba(249, 115, 22, 0.12)",
              tension: 0.3,
              pointRadius: 3,
              yAxisID: "y"
            },
            {
              label: "Humedad (%)",
              data: humidities,
              borderColor: "#38bdf8",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              tension: 0.3,
              pointRadius: 3,
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
            y1: { position: "right", title: { display: true, text: "%" }, grid: { drawOnChartArea: false } },
            x: { title: { display: true, text: "Hora" } }
          },
          plugins: { legend: { position: "bottom" } }
        }
      });
      applyChartTheme(historyChart, document.documentElement.getAttribute("data-theme") || "dark");
    } else {
      historyChart.data.labels = labels;
      historyChart.data.datasets[0].data = temperatures;
      historyChart.data.datasets[1].data = humidities;
      historyChart.update();
    }
  }

  function renderUnifiedGeoCard(data, getWeatherMetaFn) {
    if (!data) return;
    var info = getWeatherMetaFn(data.code);

    var locEl = document.getElementById("homeGeoLoc");
    var descEl = document.getElementById("homeGeoDesc");
    var iconEl = document.getElementById("homeGeoIcon");
    var tempEl = document.getElementById("homeGeoTemp");
    var humEl = document.getElementById("homeGeoHum");
    var feelsEl = document.getElementById("homeGeoFeels");
    var windEl = document.getElementById("homeGeoWind");
    var noteEl = document.getElementById("homeGeoNote");

    if (locEl) locEl.textContent = "📍 " + (data.place || "Tu ubicación");
    if (descEl) descEl.textContent = info.text;
    if (iconEl) iconEl.textContent = info.icon;
    if (tempEl) tempEl.innerHTML = Math.round(data.temp) + "<small>°C</small>";
    if (humEl) humEl.innerHTML = data.humidity + "<small>%</small>";
    if (feelsEl) feelsEl.textContent = Math.round(data.feels) + " °C";
    if (windEl) windEl.textContent = Math.round(data.wind || 0) + " km/h";
    geoUpdated = new Date(data.updated).toLocaleString("es-CL", { hour12: false });
    if (noteEl) noteEl.textContent = "Última consulta: " + geoUpdated;
    var dot = document.getElementById("homeGeoDot");
    if (dot) dot.className = "status-dot status-normal";
  }

  function setGeoStatus(message, isLoading) {
    var noteEl = document.getElementById("homeGeoNote");
    var refreshBtn = document.getElementById("homeGeoRefresh");
    var dot = document.getElementById("homeGeoDot");
    if (dot && message) dot.className = "status-dot status-precaucion";
    if (noteEl && message) noteEl.textContent = message + (geoUpdated ? " · Último dato: " + geoUpdated : "");
    if (message && !geoUpdated) {
      var locEl = document.getElementById("homeGeoLoc");
      var descEl = document.getElementById("homeGeoDesc");
      var iconEl = document.getElementById("homeGeoIcon");
      if (locEl) locEl.textContent = isLoading ? "📍 Obteniendo ubicación..." : "📍 Ubicación no disponible";
      if (descEl) descEl.textContent = isLoading ? "Consultando la ubicación del navegador..." : "Puedes reintentar o consultar el clima por ciudad.";
      if (iconEl) iconEl.textContent = isLoading ? "🌡️" : "🌍";
    }
    if (refreshBtn) {
      refreshBtn.disabled = Boolean(isLoading);
      refreshBtn.textContent = isLoading ? "⏳ Buscando..." : "🔄 Actualizar";
    }
  }

  function setCitySearchLoading(isLoading) {
    var form = document.getElementById("weatherForm");
    if (!form) return;
    var btn = form.querySelector("button[type='submit']");
    if (btn) {
      btn.disabled = isLoading;
      btn.textContent = isLoading ? "Buscando..." : "Buscar";
    }
  }

  function showWeatherMessage(type, text) {
    var box = document.getElementById("weatherMessage");
    if (!box) return;
    if (!text) { box.hidden = true; box.textContent = ""; return; }
    box.hidden = false;
    box.className = "alert alert-" + type;
    box.textContent = text;
  }

  function clearCityWeather() {
    ["currentWeather", "forecastTitle", "weatherSource"].forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.hidden = true;
    });
    var grid = document.getElementById("forecastGrid");
    if (grid) grid.innerHTML = "";
  }

  function renderCityWeather(payload, getWeatherMetaFn) {
    var currentCard = document.getElementById("currentWeather");
    var badgeEl = document.getElementById("weatherThemeBadge");
    var forecastTitle = document.getElementById("forecastTitle");
    var forecastGrid = document.getElementById("forecastGrid");
    var sourceEl = document.getElementById("weatherSource");
    var input = document.getElementById("cityInput");

    var cur = payload.current;
    var info = getWeatherMetaFn(cur.weather_code);

    currentCard.className = "weather-card wx-theme-" + info.theme;
    if (badgeEl) badgeEl.textContent = info.badge;

    document.getElementById("weatherLocation").textContent = payload.locationName;
    document.getElementById("weatherTime").textContent = "Actualizado: " + new Date().toLocaleString("es-CL");
    document.getElementById("weatherIcon").textContent = info.icon;
    document.getElementById("weatherTemp").textContent = Math.round(cur.temperature_2m) + "°C";
    document.getElementById("weatherDesc").textContent = info.text;
    document.getElementById("weatherFeels").textContent = Math.round(cur.apparent_temperature) + " °C";
    document.getElementById("weatherHumidity").textContent = cur.relative_humidity_2m + " %";
    document.getElementById("weatherWind").textContent = Math.round(cur.wind_speed_10m) + " km/h";

    if (input) input.value = payload.locationName;
    currentCard.hidden = false;

    forecastGrid.innerHTML = "";
    var days = payload.daily.time.slice(1, 6);
    if (days.length > 0) {
      forecastTitle.hidden = false;
      days.forEach(function (iso, index) {
        var dIndex = index + 1;
        var dInfo = getWeatherMetaFn(payload.daily.weather_code[dIndex]);
        var card = document.createElement("article");
        card.className = "forecast-card";
        card.innerHTML =
          '<span class="forecast-day">' + escapeHtml(formatDay(iso)) + "</span>" +
          '<span class="forecast-icon">' + dInfo.icon + "</span>" +
          '<span class="forecast-temp">' + Math.round(payload.daily.temperature_2m_max[dIndex]) + "° / " + Math.round(payload.daily.temperature_2m_min[dIndex]) + "°</span>" +
          '<span class="forecast-minmax">Máx / Mín</span>' +
          '<span class="forecast-precip">Prob. lluvia: ' + (payload.daily.precipitation_probability_max[dIndex] === null ? "Sin datos" : payload.daily.precipitation_probability_max[dIndex] + " %") + "</span>";
        forecastGrid.appendChild(card);
      });
    }
    sourceEl.hidden = false;
  }

  function fillThresholdsForm(cfg) {
    document.getElementById("coldThreshold").value = cfg.coldThreshold;
    document.getElementById("cautionThreshold").value = cfg.cautionThreshold;
    document.getElementById("calorThreshold").value = cfg.calorThreshold;
    document.getElementById("criticalThreshold").value = cfg.criticalThreshold;
  }

  function readThresholdsForm() {
    return {
      coldThreshold: document.getElementById("coldThreshold").value.trim(),
      cautionThreshold: document.getElementById("cautionThreshold").value.trim(),
      calorThreshold: document.getElementById("calorThreshold").value.trim(),
      criticalThreshold: document.getElementById("criticalThreshold").value.trim()
    };
  }

  function clearFieldErrors() {
    ["coldThreshold", "cautionThreshold", "calorThreshold", "criticalThreshold"].forEach(function (field) {
      var input = document.getElementById(field);
      var error = document.getElementById(field + "Error");
      if (error) error.textContent = "";
      if (input) {
        input.classList.remove("input-validation-error");
        input.removeAttribute("aria-invalid");
      }
    });
  }

  function renderFieldErrors(errors) {
    Object.keys(errors).forEach(function (field) {
      var input = document.getElementById(field);
      var error = document.getElementById(field + "Error");
      if (error) error.textContent = errors[field];
      if (input) {
        input.classList.add("input-validation-error");
        input.setAttribute("aria-invalid", "true");
      }
    });
  }

  function showSettingsMessage(type, text) {
    var box = document.getElementById("settingsMessage");
    if (!box) return;
    box.hidden = false;
    box.className = "alert alert-" + type;
    box.textContent = text;
  }

  return {
    applyTheme: applyTheme,
    renderModeBanner: renderModeBanner,
    renderDashboard: renderDashboard,
    renderLiveChart: function (readings) {
      renderChartSafely("liveChart", function () { renderLiveChart(readings); });
    },
    renderHistory: renderHistory,
    renderUnifiedGeoCard: renderUnifiedGeoCard,
    setGeoStatus: setGeoStatus,
    setCitySearchLoading: setCitySearchLoading,
    showWeatherMessage: showWeatherMessage,
    clearCityWeather: clearCityWeather,
    renderCityWeather: renderCityWeather,
    fillThresholdsForm: fillThresholdsForm,
    readThresholdsForm: readThresholdsForm,
    clearFieldErrors: clearFieldErrors,
    renderFieldErrors: renderFieldErrors,
    showSettingsMessage: showSettingsMessage
  };
})();
