/* ==========================================================================
   PetSafe IoT — Capa de presentación (DOM)
   ========================================================================== */
(function (global) {
  'use strict';

  var S = global.Store;
  var $ = function (id) { return document.getElementById(id); };

  var UI = {};

  /* ---------------- Dashboard ---------------- */
  UI.dashboard = function () {
    var st = S.state, cur = st.current, S0 = S.state.settings;
    var tempState = st.currentState || S.STATES.NORMAL;

    // cabecera
    $('petAvatar').textContent = S0.pet.emoji;
    $('petName').textContent = S0.pet.name;
    $('petRoom').textContent = S0.pet.room;
    var rssi = st.device.rssi;
    $('connLine').textContent = (st.mode === 'serial' ? 'ESP32 · USB' : 'ESP32 · DHT22')
      + ' · ' + (cur ? S.fmtClock(cur.t) : '—') + ' · ' + (rssi > -70 ? 'buena' : rssi > -85 ? 'regular' : 'débil');

    // banner
    var hint = {
      FRIO: 'Frío en la habitación, riesgo de hipotermia',
      NORMAL: 'Ambiente cómodo para ' + S0.pet.name,
      CALOR: 'Calor detectado: el ventilador se activa',
      CRITICO: '¡Riesgo alto! Ventilador al máximo'
    };
    var b = $('stateBanner');
    b.setAttribute('data-s', tempState.key);
    $('sbIco').textContent = tempState.ico;
    $('sbTitle').textContent = 'Estado: ' + tempState.label;
    $('sbHint').textContent = hint[tempState.key];
    $('sbPulse').className = 'sb-pulse' + (tempState.key === 'CRITICO' ? ' on' : '');

    // medidores
    if (cur) {
      $('tempVal').innerHTML = cur.temp.toFixed(1) + '<span class="u">°C</span>';
      $('humVal').innerHTML = Math.round(cur.hum) + '<span class="u">%</span>';
    }
    var tt = $('tempTag');
    tt.className = 'tag ' + tempState.key;
    tt.textContent = tempState.ico + ' ' + tempState.label;
    $('tempVal').style.color = tempState.color;

    var hL = S.humidityLabel(cur ? cur.hum : 55);
    var ht = $('humTag');
    ht.className = 'tag ' + (cur && cur.hum < S0.humidity.min ? 'CALOR' : (cur && cur.hum > S0.humidity.max ? 'FRIO' : 'NORMAL'));
    ht.textContent = hL.txt;
    $('humVal').style.color = hL.color;
    $('humNote').textContent = 'rango ' + S0.humidity.min + '–' + S0.humidity.max + '%';

    // arcos: 10..36 °C  y  20..95 %
    var fracT = cur ? (cur.temp - 10) / 26 : 0;
    var fracH = cur ? (cur.hum - 20) / 75 : 0;
    global.Chart.arc($('arcTemp'), fracT);
    global.Chart.arc($('arcHum'), fracH);

    var s24 = S.stats(24);
    $('tempMin').textContent = s24 ? 'mín ' + s24.min + '°' : 'mín —';
    $('tempMax').textContent = s24 ? 'máx ' + s24.max + '°' : 'máx —';

    // actuador
    var on = st.fan.on;
    var fb = $('fanBtn');
    fb.classList.toggle('on', on);
    fb.classList.toggle('spin', on);
    fb.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('powerChip').className = 'power-chip' + (on ? ' on' : '');
    $('powerChip').textContent = on ? 'ON' : 'OFF';
    $('fanTitle').textContent = 'Ventilador' + (S0.opts.auto ? ' (Auto)' : ' (Manual)');
    $('fanHint').textContent = on
      ? (S0.opts.auto ? 'Encendido automáticamente por ' + tempState.label.toLowerCase() : 'Encendido manual')
      : (S0.opts.auto ? 'Apagado — ambiente estable' : 'Apagado manualmente');
    $('modeAuto').classList.toggle('active', S0.opts.auto);
    $('modeMan').classList.toggle('active', !S0.opts.auto);

    // estadísticas
    $('stMin').textContent = s24 ? s24.min + '°' : '—';
    $('stMax').textContent = s24 ? s24.max + '°' : '—';
    $('stAvg').textContent = s24 ? s24.avg + '°' : '—';
    $('stAlerts').textContent = S.eventsSince(24).length;

    // conexión
    $('kvDev').textContent = st.device.id;
    $('kvRssi').textContent = rssi + ' dBm';
    $('kvAge').textContent = cur ? S.age(cur.t) : '—';
    $('kvMode').textContent = st.mode === 'serial' ? 'ESP32 USB' : 'Simulador';
  };

  /* ---------------- Historial ---------------- */
  UI.history = function (filter) {
    var list = $('logList');
    var items = S.state.events.filter(function (e) {
      return !filter || filter === 'all' || e.state === filter;
    });
    $('logCount').textContent = items.length;
    list.innerHTML = '';
    $('logEmpty').hidden = items.length > 0;

    var lastDay = null;
    items.forEach(function (e) {
      var meta = S.STATES[e.state] || S.STATES.NORMAL;
      var day = S.dayLabel(e.ts);
      if (day !== lastDay) {
        var h = document.createElement('li');
        h.className = 'log-day';
        h.style.cssText = 'display:block;border:0;background:none;box-shadow:none;padding:0;';
        h.textContent = day;
        list.appendChild(h);
        lastDay = day;
      }
      var li = document.createElement('li');
      li.className = e.state;
      li.innerHTML =
        '<div class="log-dot">' + meta.ico + '</div>' +
        '<div class="log-body">' +
          '<div class="log-top">' +
            '<span class="log-time">' + S.fmtClock(e.ts) + '</span>' +
            '<span class="tag ' + e.state + '">' + meta.label + '</span>' +
            '<span class="log-date">' + e.temp.toFixed(1) + '°C · ' + Math.round(e.hum) + '%</span>' +
          '</div>' +
          '<div class="log-msg">' + escapeHtml(e.msg) + '</div>' +
          '<span class="log-act">' + escapeHtml(e.action || meta.action) + '</span>' +
        '</div>';
      list.appendChild(li);
    });
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- Ajustes ---------------- */
  UI.settings = function () {
    var L = S.state.settings.limits, H = S.state.settings.humidity;
    $('outCold').textContent = L.cold + '°C';
    $('outHot').textContent = L.hot + '°C';
    $('outCrit').textContent = L.crit + '°C';
    $('outHumMin').textContent = H.min + '%';
    $('outHumMax').textContent = H.max + '%';
    $('outInt').textContent = S.state.settings.interval + ' s';

    // zonas proporcionales
    var lo = 12, hi = 36;
    var zones = [
      { from: lo, to: L.cold, c: '#3B82F6', lbl: 'Frío' },
      { from: L.cold, to: L.hot, c: '#17A34A', lbl: 'Normal' },
      { from: L.hot, to: L.crit, c: '#F08A24', lbl: 'Calor' },
      { from: L.crit, to: hi, c: '#E5484D', lbl: 'Crítico' }
    ];
    var z = $('zones');
    z.innerHTML = '';
    zones.forEach(function (s) {
      var w = Math.max(0, (Math.min(s.to, hi) - Math.max(s.from, lo)) / (hi - lo));
      if (w <= 0) return;
      var d = document.createElement('div');
      d.className = 'zone';
      d.style.flexGrow = String(w);
      d.style.background = s.c;
      d.textContent = w > .16 ? s.lbl : '';
      d.title = s.lbl + ' ' + s.from + '–' + s.to + '°C';
      z.appendChild(d);
    });

    // leyenda
    var lg = $('stateLegend');
    lg.innerHTML = '';
    [
      ['#3B82F6', 'Frío', 'Ventilador OFF', '≤ ' + L.cold + '°C'],
      ['#17A34A', 'Normal', 'Ambiente estable', L.cold + ' – ' + S.round1(L.hot - 0.5) + '°C'],
      ['#F08A24', 'Calor', 'Ventilador ON', '≥ ' + L.hot + '°C'],
      ['#E5484D', 'Crítico', 'Alerta urgente', '≥ ' + L.crit + '°C']
    ].forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="dot" style="background:' + r[0] + '"></span>' +
        '<b>' + r[1] + '</b><span class="act">' + r[2] + '</span>' +
        '<span class="rng">' + r[3] + '</span>';
      lg.appendChild(li);
    });
  };

  UI.syncToggles = function () {
    var o = S.state.settings.opts;
    document.querySelectorAll('.toggle[data-opt]').forEach(function (b) {
      var k = b.getAttribute('data-opt');
      var on = !!o[k];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    document.querySelectorAll('.opt-ico').forEach(function (s) {
      var opt = s.parentElement.querySelector('.toggle');
      if (!opt) return;
      var k = opt.getAttribute('data-opt');
      s.classList.toggle('on', !!o[k]);
    });
  };

  UI.fillSettingsForm = function () {
    var s = S.state.settings;
    $('slCold').value = s.limits.cold;
    $('slHot').value = s.limits.hot;
    $('slCrit').value = s.limits.crit;
    $('slHumMin').value = s.humidity.min;
    $('slHumMax').value = s.humidity.max;
    $('slInt').value = s.interval;
    $('fName').value = s.pet.name;
    $('fRoom').value = s.pet.room;
    UI.syncToggles();
    UI.emojiRow();
    UI.settings();
  };

  var EMOJIS = ['🐕', '🐶', '🐩', '🐾', '😺', '🐰', '🦜', '🐈'];
  UI.emojiRow = function () {
    var row = $('emojiRow');
    row.innerHTML = '';
    EMOJIS.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = e;
      b.className = e === S.state.settings.pet.emoji ? 'on' : '';
      b.addEventListener('click', function () {
        S.applySettings({ pet: { emoji: e } });
        UI.emojiRow();
        UI.dashboard();
        UI.toast('Icono actualizado');
      });
      row.appendChild(b);
    });
  };

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  UI.toast = function (msg, kind) {
    var t = $('toast');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  };

  /* ---------------- Hoja de alerta ---------------- */
  UI.sheet = function (title, sub, msg) {
    $('shTitle').textContent = title;
    $('shSub').textContent = sub;
    $('shMsg').textContent = msg;
    $('sheetWrap').hidden = false;
  };
  UI.hideSheet = function () { $('sheetWrap').hidden = true; };

  UI.$ = $;
  UI.escapeHtml = escapeHtml;

  global.UI = UI;
})(window);