/* MeteoGuard — dashboard en vivo: consulta /Dashboard/Latest cada 5 s
   y actualiza tarjeta de estado + gráfico de temperatura (Chart.js). */
(function () {
  "use strict";

  var POLL_MS = 5000;
  var MAX_POINTS = 30;

  var tempEl = document.getElementById("tempValue");
  var humEl = document.getElementById("humValue");
  var statusText = document.getElementById("statusText");
  var statusDot = document.getElementById("statusDot");
  var lastUpdate = document.getElementById("lastUpdate");
  var thresholdPill = document.getElementById("thresholdPill");
  var liveNote = document.getElementById("liveNote");
  var canvas = document.getElementById("liveChart");

  if (!canvas || typeof Chart === "undefined") return;

  var chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Temperatura (°C)",
        data: [],
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

  function setCard(reading, config) {
    if (!reading) return;

    tempEl.innerHTML = reading.temperature.toFixed(1) + "<small>°C</small>";
    humEl.innerHTML = Math.round(reading.humidity) + "<small>%</small>";

    var state = reading.state || "Normal";
    statusText.textContent = state;
    statusDot.className = "status-dot status-" + state.toLowerCase();

    var t = new Date(reading.timestamp);
    lastUpdate.textContent = t.toLocaleTimeString("es-CL", { hour12: false });

    if (config && typeof config.calorThreshold === "number") {
      thresholdPill.textContent = config.calorThreshold + " °C";
    }

    chart.data.labels.push(t.toLocaleTimeString("es-CL", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    chart.data.datasets[0].data.push(reading.temperature);
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

  function poll() {
    fetch("/Dashboard/Latest", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (payload) {
        if (!payload.ok) throw new Error(payload.error || "respuesta inválida");
        liveNote.hidden = true;
        setCard(payload.reading, payload.config);
      })
      .catch(function () {
        liveNote.hidden = false;
        liveNote.textContent = "Sin conexión con el sensor. Reintentando…";
      });
  }

  poll();
  setInterval(poll, POLL_MS);
})();
