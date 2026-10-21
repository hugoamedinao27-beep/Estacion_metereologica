/* =========================================================
   MeteoGuard — Clima por ciudad (Open-Meteo)
   Geocoding + Forecast sin API Key. Funciona en GitHub Pages.
   ========================================================= */

(function () {
  "use strict";

  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  var STORAGE_KEY = "meteoguard_last_city";

  var form = document.getElementById("weatherForm");
  var input = document.getElementById("cityInput");
  var messageBox = document.getElementById("weatherMessage");
  var currentCard = document.getElementById("currentWeather");
  var locationEl = document.getElementById("weatherLocation");
  var timeEl = document.getElementById("weatherTime");
  var iconEl = document.getElementById("weatherIcon");
  var tempEl = document.getElementById("weatherTemp");
  var descEl = document.getElementById("weatherDesc");
  var feelsEl = document.getElementById("weatherFeels");
  var humidityEl = document.getElementById("weatherHumidity");
  var windEl = document.getElementById("weatherWind");
  var forecastTitle = document.getElementById("forecastTitle");
  var forecastGrid = document.getElementById("forecastGrid");
  var sourceEl = document.getElementById("weatherSource");
  var suggestions = document.getElementById("citySuggestions");

  var weatherMap = [
    { codes: [0], icon: "☀️", text: "Despejado" },
    { codes: [1, 2], icon: "🌤️", text: "Mayormente despejado o parcialmente nublado" },
    { codes: [3], icon: "☁️", text: "Nublado" },
    { codes: [45, 48], icon: "🌫️", text: "Niebla" },
    { codes: [51, 53, 55], icon: "🌦️", text: "Llovizna" },
    { codes: [56, 57], icon: "🌧️", text: "Llovizna helada" },
    { codes: [61, 63, 65], icon: "🌧️", text: "Lluvia" },
    { codes: [66, 67], icon: "🌧️", text: "Lluvia helada" },
    { codes: [71, 73, 75], icon: "🌨️", text: "Nieve" },
    { codes: [77], icon: "❄️", text: "Granos de nieve" },
    { codes: [80, 81, 82], icon: "🌦️", text: "Chubascos" },
    { codes: [85, 86], icon: "🌨️", text: "Chubascos de nieve" },
    { codes: [95], icon: "⛈️", text: "Tormenta eléctrica" },
    { codes: [96, 99], icon: "⛈️", text: "Tormenta con granizo" }
  ];

  function getWeatherInfo(code) {
    var c = Number(code);
    for (var i = 0; i < weatherMap.length; i++) {
      if (weatherMap[i].codes.indexOf(c) !== -1) return weatherMap[i];
    }
    return { icon: "🌡️", text: "Condiciones variables" };
  }

  function showMessage(type, text) {
    messageBox.hidden = false;
    messageBox.className = "alert alert-" + type;
    messageBox.textContent = text;
  }

  function hideMessage() {
    messageBox.hidden = true;
    messageBox.textContent = "";
  }

  function saveLastCity(city) {
    try { localStorage.setItem(STORAGE_KEY, city); } catch (e) { /* ignore */ }
  }

  function loadLastCity() {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { return ""; }
  }

  function formatDay(iso) {
    var date = new Date(iso + "T00:00:00");
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "2-digit" });
  }

  async function geocode(city) {
    var url = GEOCODE_URL + "?name=" + encodeURIComponent(city) + "&count=1&language=es&format=json";
    var response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo buscar la ciudad");
    var data = await response.json();
    if (!data.results || data.results.length === 0) throw new Error("Ciudad no encontrada");
    return data.results[0];
  }

  async function fetchForecast(lat, lon) {
    var params = [
      "latitude=" + lat,
      "longitude=" + lon,
      "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      "timezone=auto",
      "forecast_days=6"
    ];
    var url = FORECAST_URL + "?" + params.join("&");
    var response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo obtener el pronóstico");
    return response.json();
  }

  async function searchCity(city) {
    if (!city || city.trim() === "") {
      showMessage("error", "Escribe el nombre de una ciudad para buscar.");
      return;
    }

    hideMessage();
    forecastGrid.innerHTML = "";
    forecastTitle.hidden = true;
    sourceEl.hidden = true;
    currentCard.hidden = true;

    var btn = form.querySelector("button[type='submit']");
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Buscando...";

    try {
      var place = await geocode(city.trim());
      var data = await fetchForecast(place.latitude, place.longitude);
      var info = getWeatherInfo(data.current.weather_code);

      locationEl.textContent = place.name + (place.country ? ", " + place.country : "");
      timeEl.textContent = "Actualizado: " + new Date().toLocaleString("es-CL");
      iconEl.textContent = info.icon;
      tempEl.textContent = Math.round(data.current.temperature_2m) + "°C";
      descEl.textContent = info.text;
      feelsEl.textContent = Math.round(data.current.apparent_temperature) + " °C";
      humidityEl.textContent = data.current.relative_humidity_2m + " %";
      windEl.textContent = Math.round(data.current.wind_speed_10m) + " km/h";

      currentCard.hidden = false;
      currentCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

      var days = data.daily.time.slice(1, 6);
      if (days.length > 0) {
        forecastTitle.hidden = false;
        days.forEach(function (iso, index) {
          var dIndex = index + 1;
          var dInfo = getWeatherInfo(data.daily.weather_code[dIndex]);
          var card = document.createElement("article");
          card.className = "forecast-card";
          card.innerHTML =
            '<span class="forecast-day">' + formatDay(iso) + '</span>' +
            '<span class="forecast-icon">' + dInfo.icon + '</span>' +
            '<span class="forecast-temp">' + Math.round(data.daily.temperature_2m_max[dIndex]) + '° / ' + Math.round(data.daily.temperature_2m_min[dIndex]) + '°</span>' +
            '<span class="forecast-minmax">Máx / Mín</span>' +
            '<span class="forecast-precip">Prob. lluvia: ' + (data.daily.precipitation_probability_max[dIndex] ?? 0) + ' %</span>';
          forecastGrid.appendChild(card);
        });
      }

      sourceEl.hidden = false;
      saveLastCity(place.name + (place.country ? ", " + place.country : ""));
      input.value = place.name + (place.country ? ", " + place.country : "");
    } catch (error) {
      showMessage("error", error.message === "Ciudad no encontrada"
        ? "No encontramos esa ciudad. Prueba con otro nombre o usa las sugerencias."
        : "Ocurrió un error al obtener el clima. Revisa tu conexión e intenta nuevamente.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    searchCity(input.value);
  });

  if (suggestions) {
    suggestions.addEventListener("click", function (e) {
      if (e.target.matches("button[data-city]")) {
        var city = e.target.getAttribute("data-city");
        input.value = city;
        searchCity(city);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var last = loadLastCity();
    if (last) {
      input.value = last;
      searchCity(last);
    }
  });
})();
