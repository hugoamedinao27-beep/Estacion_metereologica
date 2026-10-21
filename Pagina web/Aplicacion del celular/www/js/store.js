/* ==========================================================================
   PetSafe IoT — Estado global, persistencia y máquina de estados
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'petsafe.v1';

  /* ---------- Máquina de estados ---------- */
  var STATES = {
    FRIO:    { key: 'FRIO',    label: 'Frío',    ico: '🔵', color: '#3B82F6', action: 'Ventilador OFF' },
    NORMAL:  { key: 'NORMAL',  label: 'Normal',  ico: '🟢', color: '#17A34A', action: 'Ambiente estable' },
    CALOR:   { key: 'CALOR',   label: 'Calor',   ico: '🟠', color: '#F08A24', action: 'Ventilador ON' },
    CRITICO: { key: 'CRITICO', label: 'Crítico', ico: '🔴', color: '#E5484D', action: 'Ventilador ON + Alerta urgente' }
  };

  var DEFAULTS = {
    pet: { name: 'Buddy', room: 'Habitación', emoji: '🐕' },
    limits: { cold: 20, hot: 27, crit: 28 },
    humidity: { min: 40, max: 70 },
    opts: { auto: true, alerts: true, vibrate: true, ir: false, water: false },
    interval: 5,
    device: { id: 'ESP32-PETSAFE-01', rssi: -58 }
  };

  var state = {
    settings: clone(DEFAULTS),
    readings: [],      // { t: epochMs, temp:Number, hum:Number }
    events: [],        // { id, ts, state, temp, hum, msg, action }
    current: null,     // última lectura
    device: clone(DEFAULTS.device),
    fan: { on: false, auto: true },
    mode: 'sim',       // 'sim' | 'serial'
    view: 'dashboard',
    alertCount: 0
  };

  var listeners = {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Persistencia ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (d.settings) {
        state.settings = merge(clone(DEFAULTS), d.settings);
      }
      if (Array.isArray(d.events)) state.events = d.events;
      if (Array.isArray(d.readings)) state.readings = d.readings;
      return true;
    } catch (e) {
      return false;
    }
  }

  function merge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        base[k] = merge(base[k] || {}, over[k]);
      } else if (typeof over[k] !== 'undefined') {
        base[k] = over[k];
      }
    });
    return base;
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          settings: state.settings,
          readings: state.readings.slice(-1440),
          events: state.events.slice(-500)
        }));
      } catch (e) { /* cuota llena: se ignora */ }
    }, 400);
  }

  function resetAll() {
    localStorage.removeItem(KEY);
    state.settings = clone(DEFAULTS);
    state.readings = [];
    state.events = [];
    state.current = null;
    state.fan = { on: false, auto: true };
  }

  /* ---------- Clasificación ---------- */
  function stateFor(t) {
    var L = state.settings.limits;
    if (typeof t !== 'number' || isNaN(t)) return STATES.NORMAL;
    if (t <= L.cold) return STATES.FRIO;
    if (t >= L.crit) return STATES.CRITICO;
    if (t >= L.hot) return STATES.CALOR;
    return STATES.NORMAL;
  }

  function humidityLabel(h) {
    var H = state.settings.humidity;
    if (h < H.min) return { txt: 'Seco', color: '#F08A24' };
    if (h > H.max) return { txt: 'Húmedo', color: '#2F80ED' };
    return { txt: 'Neutro', color: '#2F80ED' };
  }

  /* ---------- Lecturas ---------- */
  function addReading(temp, hum) {
    var rec = { t: Date.now(), temp: round1(temp), hum: round1(hum) };
    state.current = rec;
    state.readings.push(rec);
    if (state.readings.length > 1440) state.readings.shift();

    var st = stateFor(rec.temp);
    var prev = state.currentState;
    state.currentState = st;

    // Actuador: automático (ESP32) o manual
    if (state.settings.opts.auto) {
      var wantOn = (st.key === 'CALOR' || st.key === 'CRITICO');
      if (wantOn !== state.fan.on) {
        state.fan.on = wantOn;
        emit('fan', state.fan.on);
      }
    }

    if (prev && prev.key !== st.key) {
      logEvent(st, rec, prev);
      emit('state', { from: prev, to: st, rec: rec });
    }
    save();
    return rec;
  }

  function readingsSince(hours) {
    var cut = Date.now() - hours * 3600e3;
    return state.readings.filter(function (r) { return r.t >= cut; });
  }

  function stats(hours) {
    var rs = readingsSince(hours);
    if (!rs.length) return null;
    var mn = Infinity, mx = -Infinity, sum = 0;
    rs.forEach(function (r) {
      if (r.temp < mn) mn = r.temp;
      if (r.temp > mx) mx = r.temp;
      sum += r.temp;
    });
    return { min: round1(mn), max: round1(mx), avg: round1(sum / rs.length), n: rs.length };
  }

  /* ---------- Eventos ---------- */
  function logEvent(st, rec, prev) {
    var ev = {
      id: 'e' + Date.now() + Math.floor(Math.random() * 1000),
      ts: Date.now(),
      state: st.key,
      temp: rec.temp,
      hum: rec.hum,
      msg: message(st, rec),
      action: state.settings.opts.auto ? st.action : 'Control manual'
    };
    state.events.unshift(ev);
    if (state.events.length > 500) state.events.pop();
    save();
    return ev;
  }

  function message(st, rec) {
    var L = state.settings.limits;
    switch (st.key) {
      case 'CRITICO': return 'Temp. > Límite (' + rec.temp + '°C) · umbral ' + L.crit + '°C';
      case 'CALOR':   return 'Temp. Alta (' + rec.temp + '°C) · umbral ' + L.hot + '°C';
      case 'FRIO':    return 'Temp. Fría (' + rec.temp + '°C) · umbral ' + L.cold + '°C';
      default:        return 'Temp. Normal (' + rec.temp + '°C)';
    }
  }

  function eventsSince(hours) {
    var cut = Date.now() - hours * 3600e3;
    return state.events.filter(function (e) { return e.ts >= cut; });
  }

  function seed() {
    var now = Date.now();
    var L = state.settings.limits;
    var base = 24.2;
    for (var i = 95; i >= 0; i--) {
      var ts = now - i * 15 * 60e3;
      var hod = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
      // ciclo térmico diario: mínimo ~06:00, máximo ~16:00
      var cycle = Math.sin(((hod - 6) / 24) * Math.PI * 2 - Math.PI / 2);
      var temp = base + cycle * 4.6 + (Math.random() - .5) * .6;
      var hum = 58 - cycle * 9 + (Math.random() - .5) * 3;
      state.readings.push({ t: ts, temp: round1(temp), hum: round1(clamp(hum, 30, 80)) });
    }

    // Eventos históricos coherentes con los umbrales por defecto
    var script = [
      [36, 'CRITICO', 29.2, 'Temp. > Límite (29.2°C), Ventilador ON + Alerta Urgente.'],
      [8,  'CALOR',   28.0, 'Temp. Alta (28.0°C), Ventilador ON.'],
      [2,  'NORMAL',  26.4, 'Temp. Normal (26.4°C).'],
      [95, 'NORMAL',  24.0, 'Temp. Normal (24.0°C).'],
      [220, 'FRIO',   19.6, 'Temp. Fría (19.6°C), Ventilador OFF.']
    ];
    script.forEach(function (s) {
      var st = STATES[s[1]];
      state.events.push({
        id: 'seed' + s[0], ts: now - s[0] * 60e3, state: st.key,
        temp: s[2], hum: 55, msg: s[3], action: st.action
      });
    });
    state.events.sort(function (a, b) { return b.ts - a.ts; });
    state.current = state.readings[state.readings.length - 1];
    state.currentState = stateFor(state.current.temp);
    save();
  }

  /* ---------- Utilidades ---------- */
  function round1(n) { return Math.round(n * 10) / 10; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function fmtClock(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function fmtHm(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dayLabel(ts) {
    var d = new Date(ts), now = new Date();
    var same = d.toDateString() === now.toDateString();
    var yest = new Date(now.getTime() - 864e5).toDateString() === d.toDateString();
    var hm = pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
    if (same) return 'Hoy · ' + hm;
    if (yest) return 'Ayer · ' + hm;
    return hm;
  }

  function age(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'hace ' + s + ' s';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    return 'hace ' + Math.floor(s / 3600) + ' h';
  }

  function toCSV() {
    var head = 'fecha_hora;estado;temperatura_c;humedad_pct;accion;mensaje\n';
    var rows = state.events.map(function (e) {
      return [
        new Date(e.ts).toISOString(),
        e.state,
        e.temp,
        e.hum,
        (e.action || '').replace(/;/g, ','),
        (e.msg || '').replace(/;/g, ',')
      ].join(';');
    });
    return head + rows.join('\n');
  }

  /* ---------- Bus de eventos ---------- */
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }
  function emit(evt, data) {
    (listeners[evt] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { console.error(evt, e); }
    });
  }

  function applySettings(next) {
    state.settings = merge(state.settings, next);
    // mantiene coherencia los umbrales
    var L = state.settings.limits;
    L.cold = clamp(L.cold, 10, L.hot - 1);
    L.hot = clamp(L.hot, L.cold + 1, L.crit - 0.5);
    L.crit = clamp(L.crit, L.hot + 0.5, 40);
    if (state.current) state.currentState = stateFor(state.current.temp);
    save();
    emit('settings', state.settings);
  }

  global.Store = {
    STATES: STATES, DEFAULTS: DEFAULTS, state: state,
    load: load, save: save, resetAll: resetAll, seed: seed,
    stateFor: stateFor, humidityLabel: humidityLabel,
    addReading: addReading, readingsSince: readingsSince, stats: stats,
    eventsSince: eventsSince, logEvent: logEvent, message: message,
    fmtClock: fmtClock, fmtHm: fmtHm, dayLabel: dayLabel, age: age,
    toCSV: toCSV, round1: round1, clamp: clamp,
    on: on, emit: emit, applySettings: applySettings
  };
})(window);