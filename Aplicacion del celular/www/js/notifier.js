/* ==========================================================================
   PetSafe IoT — Notificaciones
   Usa @capacitor/local-notifications si está disponible; si no, cae a la
   Notification API del navegador y/o vibración.
   ========================================================================== */
(function (global) {
  'use strict';

  var S = global.Store;

  function plugin() {
    var cap = global.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.LocalNotifications) return cap.Plugins.LocalNotifications;
    return null;
  }

  var idSeed = 1000;

  /* Chrome bloquea navigator.vibrate() hasta que el usuario interactúa con la
     página: lo registramos para no generar errores en consola. */
  var interacted = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { interacted = true; }, { once: true, passive: true });
  });

  function notify(title, body, opts) {
    opts = opts || {};
    if (!S.state.settings.opts.alerts) return Promise.resolve(false);

    var extra = {
      channelId: 'petsafe-alerts',
      smallIcon: 'ic_stat_pet',
      iconColor: opts.color || '#E5484D',
      priority: opts.priority || 5,
      title: title,
      body: body,
      ongoing: false,
      autoCancel: true
    };

    var ln = plugin();
    if (ln && ln.schedule) {
      return ln.schedule({
        notifications: [{
          id: idSeed++,
          title: title,
          body: body,
          schedule: { at: new Date(Date.now() + 100) },
          extra: extra
        }]
      }).then(function () { return true; })
        .catch(function () { return webNotify(title, body); });
    }
    return Promise.resolve(webNotify(title, body));
  }

  function webNotify(title, body) {
    try {
      if (global.Notification && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'assets/icon/icon-192.png', tag: 'petsafe' });
        return true;
      }
      if (global.Notification && Notification.permission === 'default') {
        Notification.requestPermission().then(function (p) {
          if (p === 'granted') new Notification(title, { body: body });
        });
      }
    } catch (e) { /* silencioso */ }
    return false;
  }

  function buzz(pattern) {
    if (!S.state.settings.opts.vibrate || !interacted) return;
    try { navigator.vibrate(pattern || [60, 40, 120]); } catch (e) {}
  }

  /* Notificación específica por estado */
  function forState(st, rec) {
    var pet = S.state.settings.pet.name;
    switch (st.key) {
      case 'CRITICO':
        return {
          title: '¡ALERTA URGENTE!',
          body: 'Temp. Crítica en habitación. ' + pet + ' está a ' + rec.temp + '°C. Ventilador encendido.',
          color: '#E5484D', buzz: [80, 50, 80, 50, 200]
        };
      case 'CALOR':
        return {
          title: 'Temperatura alta',
          body: pet + ': ' + rec.temp + '°C en ' + S.state.settings.pet.room + '. Ventilador encendido.',
          color: '#F08A24', buzz: [80]
        };
      case 'FRIO':
        return {
          title: 'Temperatura baja',
          body: pet + ': ' + rec.temp + '°C en ' + S.state.settings.pet.room + '. Ventilador apagado.',
          color: '#3B82F6', buzz: null
        };
      default:
        return null;
    }
  }

  function requestPermission() {
    var ln = plugin();
    if (ln && ln.requestPermissions) {
      return ln.requestPermissions().then(function (r) { return r.display === 'granted'; })
        .catch(function () { return false; });
    }
    if (global.Notification && Notification.permission === 'default') {
      return Notification.requestPermission().then(function (p) { return p === 'granted'; });
    }
    return Promise.resolve(false);
  }

  global.Notifier = {
    notify: notify, buzz: buzz, forState: forState, requestPermission: requestPermission
  };
})(window);