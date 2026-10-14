/* ==========================================================================
   PetSafe IoT — Arranque, navegación y eventos de la interfaz
   ========================================================================== */
(function (global) {
  'use strict';

  var S = global.Store, U = global.UI, N = global.Notifier, C = global.Chart;
  var $ = U.$;

  var chartHours = 24;
  var logFilter = 'all';

  /* ---------------- Navegación ---------------- */
  function show(view) {
    S.state.view = view;
    ['dashboard', 'history', 'settings'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-view') === view);
    });
    $('scroll').scrollTop = 0;
    if (view === 'history') U.history(logFilter);
    if (view === 'settings') U.settings();
    if (view === 'dashboard') renderChart();
  }

  function renderChart() {
    C.render($('chartHost'), $('yAxis'), $('xAxis'), chartHours);
  }

  /* ---------------- Refrescos ---------------- */
  function refreshAll() {
    U.dashboard();
    if (S.state.view === 'dashboard') renderChart();
    if (S.state.view === 'history') U.history(logFilter);
    if (S.state.view === 'settings') U.settings();
  }

  /* ---------------- Cambio de estado ---------------- */
  S.on('state', function (p) {
    U.dashboard();
    var n = N.forState(p.to, p.rec);
    if (!n) return;

    // aviso en pantalla
    if (p.to.key === 'CRITICO') {
      U.sheet('¡ALERTA URGENTE!', 'PetSafe IoT · ' + S.fmtClock(p.rec.t),
        'Temp. Crítica en habitación. ' + S.state.settings.pet.name + ' está a '
        + p.rec.temp.toFixed(1) + '°C, por encima del límite configurado ('
        + S.state.settings.limits.crit + '°C). Ventilador encendido automáticamente.');
    } else if (p.to.key === 'CALOR') {
      U.toast('🌡️ Calor: ' + p.rec.temp.toFixed(1) + '°C · ventilador encendido', 'err');
    }

    if (n.buzz) N.buzz(n.buzz);
    N.notify(n.title, n.body, { color: n.color });

    // insignia en la pestaña Historial
    var tab = document.querySelector('.tab[data-view="history"]');
    var b = tab.querySelector('.badge');
    if (b) b.remove();
    if (p.to.key === 'CRITICO' || p.to.key === 'CALOR') {
      var el = document.createElement('span');
      el.className = 'badge';
      el.textContent = S.state.events.length > 99 ? '99+' : S.state.events.length;
      tab.appendChild(el);
    }
  });

  S.on('fan', function () { U.dashboard(); });

  S.on('settings', function () {
    U.dashboard();
    U.settings();
    renderChart();
  });

  /* ---------------- Enlaces de UI ---------------- */
  function wire() {

    // pestañas
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { show(t.getAttribute('data-view')); });
    });

    // chip de mascota -> ajustes
    $('petChip').addEventListener('click', function () { show('settings'); });

    // rango del gráfico
    $('chartRange').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      this.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      chartHours = parseInt(b.getAttribute('data-h'), 10);
      renderChart();
    });

    // ventilador
    $('fanBtn').addEventListener('click', function () {
      var auto = S.state.settings.opts.auto;
      if (auto) {
        // se desactiva el auto para permitir el control manual
        S.applySettings({ opts: { auto: false } });
        U.syncToggles();
        global.Sensor.pushFan(true);
        U.toast('Control manual activado · ventilador ON');
      } else {
        global.Sensor.pushFan(!S.state.fan.on);
        U.toast(S.state.fan.on ? 'Ventilador encendido' : 'Ventilador apagado',
          S.state.fan.on ? 'ok' : '');
      }
    });
    $('modeAuto').addEventListener('click', function () {
      S.applySettings({ opts: { auto: true } });
      U.syncToggles();
      U.dashboard();
      U.toast('Control automático ESP32 activado', 'ok');
    });
    $('modeMan').addEventListener('click', function () {
      S.applySettings({ opts: { auto: false } });
      U.syncToggles();
      U.dashboard();
      U.toast('Control manual activado');
    });

    // conexión
    $('btnSerial').addEventListener('click', function () {
      global.Sensor.serialConnect().then(function () {
        U.toast('ESP32 conectado por USB', 'ok');
        U.dashboard();
      }).catch(function (err) {
        U.toast(err.message || 'No se pudo conectar', 'err');
      });
    });
    $('btnSim').addEventListener('click', function () {
      global.Sensor.serialDisconnect();
      U.toast('Simulador activo');
      U.dashboard();
    });

    // filtros del log
    $('logFilters').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      this.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      logFilter = b.getAttribute('data-f');
      U.history(logFilter);
    });

    $('btnExport').addEventListener('click', exportCSV);
    $('btnClear').addEventListener('click', function () {
      if (!confirm('¿Borrar todo el historial de eventos?')) return;
      S.state.events = [];
      S.save();
      U.history(logFilter);
      U.toast('Historial borrado');
    });

    // sliders
    bindSlider('slCold', function (v) { return { limits: { cold: v } }; }, 'outCold', function (v) { return v + '°C'; });
    bindSlider('slHot', function (v) { return { limits: { hot: v } }; }, 'outHot', function (v) { return v + '°C'; });
    bindSlider('slCrit', function (v) { return { limits: { crit: v } }; }, 'outCrit', function (v) { return v + '°C'; });
    bindSlider('slHumMin', function (v) { return { humidity: { min: v } }; }, 'outHumMin', function (v) { return v + '%'; });
    bindSlider('slHumMax', function (v) { return { humidity: { max: v } }; }, 'outHumMax', function (v) { return v + '%'; });
    bindSlider('slInt', function (v) { return { interval: v }; }, 'outInt', function (v) { return v + ' s'; });

    // toggles
    document.querySelectorAll('.toggle[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-opt');
        if (b.disabled) {
          U.toast('Función de la v2 futura, no disponible todavía');
          return;
        }
        var next = !S.state.settings.opts[k];
        S.applySettings({ opts: (function () { var o = {}; o[k] = next; return o; })() });
        U.syncToggles();
        U.toast((next ? 'Activado: ' : 'Desactivado: ') + b.closest('.opt').querySelector('b').textContent.trim(),
          next ? 'ok' : '');
      });
    });

    // aplicar
    $('btnApply').addEventListener('click', function () {
      S.applySettings({
        pet: { name: $('fName').value.trim() || 'Buddy', room: $('fRoom').value.trim() || 'Habitación' },
        limits: {
          cold: parseFloat($('slCold').value),
          hot: parseFloat($('slHot').value),
          crit: parseFloat($('slCrit').value)
        },
        humidity: {
          min: parseInt($('slHumMin').value, 10),
          max: parseInt($('slHumMax').value, 10)
        },
        interval: parseInt($('slInt').value, 10)
      });
      U.fillSettingsForm();
      U.dashboard();
      global.Sensor.start();
      U.toast('Cambios aplicados', 'ok');
      N.buzz(35);
    });

    $('btnTestNotif').addEventListener('click', function () {
      N.requestPermission();
      N.buzz([70, 50, 70]);
      N.notify('PetSafe IoT — prueba', 'Las notificaciones funcionan correctamente.',
        { color: '#1F6FEB' });
      U.toast('Notificación de prueba enviada', 'ok');
    });

    $('btnReset').addEventListener('click', function () {
      if (!confirm('¿Restablecer toda la configuración y el historial?')) return;
      S.resetAll();
      S.seed();
      U.fillSettingsForm();
      refreshAll();
      global.Sensor.start();
      U.toast('Configuración restablecida');
    });

    // hoja de alerta
    $('shDismiss').addEventListener('click', function () { U.hideSheet(); });
    $('shOpen').addEventListener('click', function () { U.hideSheet(); show('history'); });
    $('scrim').addEventListener('click', function () { U.hideSheet(); });
  }

  function bindSlider(id, map, outId, fmt) {
    var el = $(id);
    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      S.applySettings(map(v));
      $(outId).textContent = fmt(v);
      if (id === 'slInt') { /* se aplica al pulsar Aplicar */ }
    });
  }

  function exportCSV() {
    var csv = S.toCSV();
    try {
      var cap = global.Capacitor;
      var Files = cap && cap.Plugins && cap.Plugins.Filesystem;
      if (Files && Files.writeFile) {
        Files.writeFile({
          path: 'petsafe-historial.csv',
          data: csv,
          directory: 'Documents',
          encoding: 'utf8',
          recursive: true
        }).then(function () { U.toast('CSV guardado en Documentos', 'ok'); })
          .catch(function () { download(csv); });
      } else {
        download(csv);
      }
    } catch (e) {
      download(csv);
    }
  }

  function download(csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'petsafe-historial.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    U.toast('CSV descargado', 'ok');
  }

  /* ---------------- Arranque ---------------- */
  function boot() {
    var had = S.load();
    if (!had || !S.state.readings.length) S.seed();

    S.state.device.id = S.state.device.id || S.DEFAULTS.device.id;

    wire();
    U.fillSettingsForm();
    show('dashboard');
    global.Sensor.start();
    N.requestPermission();

    // refresco periódico (edad de la lectura, stats)
    setInterval(function () {
      if (S.state.view === 'dashboard') U.dashboard();
    }, 1000);

    // gestión del botón físico atrás
    document.addEventListener('backbutton', function (e) {
      if (!$('sheetWrap').hidden) { e.preventDefault(); U.hideSheet(); return; }
      if (S.state.view !== 'dashboard') { e.preventDefault(); show('dashboard'); }
    }, false);

    window.addEventListener('resume', function () {
      global.Sensor.start();
      U.dashboard();
    });

    console.log('PetSafe IoT listo ·', S.state.readings.length, 'lecturas ·',
      S.state.events.length, 'eventos');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);