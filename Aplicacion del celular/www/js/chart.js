/* ==========================================================================
   PetSafe IoT — Gráfico SVG (sin librerías)
   Área + línea + bandas de umbral + marcadores
   ========================================================================== */
(function (global) {
  'use strict';

  var S = global.Store;

  function render(host, yAxisEl, xAxisEl, hours) {
    var data = S.readingsSince(hours);
    host.innerHTML = '';
    yAxisEl.innerHTML = '';
    xAxisEl.innerHTML = '';

    if (data.length < 2) {
      host.innerHTML = '<div class="empty" style="padding:30px 0"><span>📈</span>'
        + '<b>Sin datos suficientes</b><small>Esperando lecturas del sensor…</small></div>';
      return;
    }

    var W = 300, H = 168, PT = 8, PB = 6, PL = 2, PR = 2;
    var L = S.state.settings.limits;

    // Dominio del eje Y, con un margen que siempre incluya los umbrales
    var mn = Infinity, mx = -Infinity;
    data.forEach(function (d) { if (d.temp < mn) mn = d.temp; if (d.temp > mx) mx = d.temp; });
    mn = Math.min(mn, L.cold); mx = Math.max(mx, L.crit);
    var span = Math.max(4, mx - mn);
    mn -= span * .12; mx += span * .12;

    var iw = W - PL - PR, ih = H - PT - PB;
    var t0 = data[0].t, t1 = data[data.length - 1].t;
    var spanT = Math.max(1, t1 - t0);

    function X(t) { return PL + ((t - t0) / spanT) * iw; }
    function Y(v) { return PT + (1 - (v - mn) / (mx - mn)) * ih; }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');

    function el(tag, attrs) {
      var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    // --- bandas de umbral ---
    var bands = [
      { from: mn, to: L.cold, c: 'rgba(59,130,246,.08)' },
      { from: L.cold, to: L.hot, c: 'rgba(23,163,74,.07)' },
      { from: L.hot, to: L.crit, c: 'rgba(240,138,36,.09)' },
      { from: L.crit, to: mx, c: 'rgba(229,72,77,.10)' }
    ];
    bands.forEach(function (b) {
      var y1 = Y(Math.min(b.to, mx)), y2 = Y(Math.max(b.from, mn));
      if (y2 - y1 < 0.5) return;
      svg.appendChild(el('rect', { x: 0, y: y1, width: W, height: y2 - y1, fill: b.c }));
    });

    // --- rejilla horizontal ---
    [0, .25, .5, .75, 1].forEach(function (f) {
      var y = PT + f * ih;
      svg.appendChild(el('line', {
        x1: 0, y1: y, x2: W, y2: y,
        stroke: f === 1 ? '#e6eaf0' : '#f0f3f7', 'stroke-width': 1
      }));
    });

    // --- líneas de umbral ---
    [['#3B82F6', L.cold], ['#F08A24', L.hot], ['#E5484D', L.crit]].forEach(function (u) {
      if (u[1] < mn || u[1] > mx) return;
      svg.appendChild(el('line', {
        x1: 0, y1: Y(u[1]), x2: W, y2: Y(u[1]),
        stroke: u[0], 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: .75
      }));
    });

    // --- línea de datos ---
    var dLine = '', dArea = '';
    data.forEach(function (d, i) {
      var x = X(d.t).toFixed(2), y = Y(d.temp).toFixed(2);
      dLine += (i ? ' L' : 'M') + x + ' ' + y;
    });
    dArea = dLine + ' L' + X(t1).toFixed(2) + ' ' + (PT + ih) + ' L' + X(t0).toFixed(2) + ' ' + (PT + ih) + ' Z';

    var defs = el('defs', {});
    var grad = el('linearGradient', { id: 'chartFill', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#2F80ED', 'stop-opacity': '.28' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#2F80ED', 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    svg.appendChild(el('path', { d: dArea, fill: 'url(#chartFill)' }));

    // el color de la línea sigue el estado actual
    var cur = S.state.currentState || S.STATES.NORMAL;
    svg.appendChild(el('path', {
      d: dLine, fill: 'none', stroke: cur.color,
      'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));

    // --- punto actual ---
    var last = data[data.length - 1];
    var lx = X(last.t), ly = Y(last.temp);
    svg.appendChild(el('circle', { cx: lx, cy: ly, r: 6.5, fill: cur.color, opacity: .18 }));
    svg.appendChild(el('circle', { cx: lx, cy: ly, r: 3.6, fill: '#fff', stroke: cur.color, 'stroke-width': 2.4 }));

    // etiquetas de umbral dentro del gráfico
    [['28°', L.crit, '#E5484D'], ['27°', L.hot, '#F08A24'], ['20°', L.cold, '#3B82F6']].forEach(function (u) {
      if (u[1] < mn || u[1] > mx) return;
      var t = el('text', {
        x: W - 3, y: Y(u[1]) - 4, 'font-size': 8.5, 'font-weight': 700,
        fill: u[2], 'text-anchor': 'end', opacity: .9
      });
      t.textContent = u[0];
      svg.appendChild(t);
    });

    host.appendChild(svg);

    // --- ejes ---
    [mx, (mx + mn) / 2, mn].forEach(function (v) {
      var d = document.createElement('div');
      d.textContent = Math.round(v) + '°';
      yAxisEl.appendChild(d);
    });

    var ticks = 4, lab = [];
    for (var i = 0; i <= ticks; i++) {
      var t = t0 + (spanT * i) / ticks;
      lab.push(i === ticks ? S.fmtHm(new Date(t1).getTime()) : S.fmtHm(t));
    }
    lab.forEach(function (s) {
      var d = document.createElement('div');
      d.textContent = s;
      xAxisEl.appendChild(d);
    });
  }

  /* Medidor de arco de los gauges */
  function arc(pathEl, frac) {
    var len = 157; // longitud del semicírculo (r=50)
    frac = S.clamp(frac, 0, 1);
    pathEl.style.strokeDasharray = len;
    pathEl.style.strokeDashoffset = len * (1 - frac);
  }

  global.Chart = { render: render, arc: arc };
})(window);