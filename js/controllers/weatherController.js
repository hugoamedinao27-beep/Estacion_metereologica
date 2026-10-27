/* =========================================================
   MeteoGuard — CAPA DE CONTROLADOR (weatherController.js)
   ========================================================= */

window.MeteoGuard = window.MeteoGuard || {};

window.MeteoGuard.Controller = (function (Model, View) {
  "use strict";

  var REFRESH_MS = 5000;
  var citySearchId = 0;

  function refreshStorageBanner() {
    var status = Model.getStorageStatus();
    View.renderModeBanner(Model.isUsingFirebase(), status.failed, status.recovered);
  }

  function setupThemeToggle() {
    var currentTheme = Model.getSavedTheme();
    View.applyTheme(currentTheme);

    var toggleBtn = document.getElementById("themeToggle");
    if (!toggleBtn) return;

    toggleBtn.addEventListener("click", function () {
      var active = document.documentElement.getAttribute("data-theme") || "dark";
      var nextTheme = active === "dark" ? "light" : "dark";
      Model.saveTheme(nextTheme);
      View.applyTheme(nextTheme);
      refreshStorageBanner();
    });
  }

  function setupMobileNav() {
    var nav = document.getElementById("primaryNav");
    var toggle = document.getElementById("navToggle");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menú de navegación");
      }
    });
  }

  async function refreshAllViews() {
    var readings = await Model.loadReadings(120);
    var latest = readings[readings.length - 1];
    var cfg = Model.getCurrentConfig();

    var stateMeta = latest ? Model.getStateMetadata(latest.state) : Model.getStateMetadata("Normal");
    var gauges = Model.calculateGauges(latest, cfg);
    var kpis = Model.calculateKPIs(readings);

    View.renderDashboard(latest, cfg, stateMeta, gauges, kpis);
    View.renderLiveChart(readings.slice(-30));
    View.renderHistory(readings, Model.getStateMetadata);
    refreshStorageBanner();
  }

  function setupSimulationControls() {
    var simContainer = document.getElementById("simButtons");
    var forceTickBtn = document.getElementById("forceTickBtn");

    if (simContainer) {
      simContainer.addEventListener("click", async function (e) {
        var btn = e.target.closest("button[data-sim]");
        if (!btn) return;

        var type = btn.getAttribute("data-sim");
        await Model.simulateState(type);
        await refreshAllViews();
      });
    }

    if (forceTickBtn) {
      forceTickBtn.addEventListener("click", async function () {
        await Model.simulateTick();
        await refreshAllViews();
      });
    }
  }

  function triggerGeolocation() {
    if (!navigator.geolocation) {
      View.setGeoStatus("Geolocalización no soportada en este navegador.", false);
      return;
    }

    View.setGeoStatus("Obteniendo coordenadas GPS...", true);

    navigator.geolocation.getCurrentPosition(
      async function (pos) {
        try {
          var data = await Model.fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
          View.renderUnifiedGeoCard(data, Model.getWeatherMetadata);
        } catch (e) {
          View.setGeoStatus("No se pudo obtener clima de tu ubicación.", false);
        } finally {
          View.setGeoStatus(null, false);
        }
      },
      function (err) {
        var msg = err.code === 1 ? "Permiso GPS denegado" : "GPS no disponible";
        View.setGeoStatus(msg, false);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  function setupUnifiedGeolocation() {
    var cached = Model.getCachedGeoWeather();
    if (cached) {
      View.renderUnifiedGeoCard(cached, Model.getWeatherMetadata);
    }

    var refreshBtn = document.getElementById("homeGeoRefresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", triggerGeolocation);
    }

    triggerGeolocation();
  }

  async function searchCity(cityQuery) {
    var requestId = ++citySearchId;
    View.clearCityWeather();
    if (!cityQuery || cityQuery.trim() === "") {
      View.setCitySearchLoading(false);
      View.showWeatherMessage("error", "Escribe el nombre de una ciudad para buscar.");
      return;
    }

    View.showWeatherMessage(null, "");
    View.setCitySearchLoading(true);

    try {
      var payload = await Model.fetchCityWeather(cityQuery.trim());
      // Una respuesta antigua no debe reemplazar la última ciudad solicitada.
      if (requestId !== citySearchId) return;
      View.renderCityWeather(payload, Model.getWeatherMetadata);
      Model.rememberCity(payload.locationName);
      refreshStorageBanner();
    } catch (err) {
      if (requestId !== citySearchId) return;
      View.showWeatherMessage(
        "error",
        err.message === "NOT_FOUND"
          ? "No encontramos esa ciudad. Prueba con otro nombre o usa las sugerencias."
          : "Ocurrió un error al obtener el clima. Revisa tu conexión e intenta nuevamente."
      );
    } finally {
      if (requestId === citySearchId) View.setCitySearchLoading(false);
    }
  }

  function setupCityWeather() {
    var form = document.getElementById("weatherForm");
    var input = document.getElementById("cityInput");
    var suggestions = document.getElementById("citySuggestions");

    if (form && input) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        searchCity(input.value);
      });
    }

    if (suggestions) {
      suggestions.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-city]");
        if (!btn) return;
        var city = btn.getAttribute("data-city");
        if (input) input.value = city;
        searchCity(city);
      });
    }

    var lastCity = Model.getLastSearchedCity();
    if (lastCity) searchCity(lastCity);
  }

  function setupSettingsForm() {
    var form = document.getElementById("settingsForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      View.clearFieldErrors();

      var values = View.readThresholdsForm();
      var validation = Model.validateThresholds(values);

      if (!validation.isValid) {
        View.renderFieldErrors(validation.errors);
        View.showSettingsMessage("error", "Revise los errores: los umbrales no son válidos.");
        return;
      }

      try {
        await Model.saveConfig(values);
        View.showSettingsMessage("success", "Umbrales guardados. El dashboard y el historial se interpretan con los nuevos límites.");
        await refreshAllViews();
      } catch (err) {
        View.showSettingsMessage("error", "No fue posible guardar: " + err.message);
      } finally {
        refreshStorageBanner();
      }
    });
  }

  async function init() {
    setupThemeToggle();
    setupMobileNav();
    refreshStorageBanner();

    var cfg = await Model.loadConfig();
    View.fillThresholdsForm(cfg);

    setupSettingsForm();
    setupSimulationControls();
    setupUnifiedGeolocation();
    setupCityWeather();

    await Model.simulateTick();
    await refreshAllViews();

    setInterval(async function () {
      await Model.simulateTick();
      await refreshAllViews();
    }, Model.SIM_INTERVAL);

    setInterval(refreshAllViews, REFRESH_MS);
  }

  document.addEventListener("DOMContentLoaded", init);

  return { init: init };
})(window.MeteoGuard.Model, window.MeteoGuard.View);
