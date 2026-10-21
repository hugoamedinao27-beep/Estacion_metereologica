/* MeteoGuard — historial: gráfico de temperatura y humedad
   a partir de window.__historyData (inyectado por la vista Razor). */
(function () {
  "use strict";

  var canvas = document.getElementById("historyChart");
  var data = window.__historyData;

  if (!canvas || typeof Chart === "undefined" || !Array.isArray(data) || data.length === 0) return;

  new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map(function (r) { return r.t; }),
      datasets: [
        {
          label: "Temperatura (°C)",
          data: data.map(function (r) { return r.temperature; }),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.10)",
          tension: 0.3,
          pointRadius: 2,
          yAxisID: "y"
        },
        {
          label: "Humedad (%)",
          data: data.map(function (r) { return r.humidity; }),
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
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
})();
