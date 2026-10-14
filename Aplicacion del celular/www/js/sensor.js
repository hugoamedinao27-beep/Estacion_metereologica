/* ==========================================================================
   PetSafe IoT — Capa de sensor
   Dos fuentes: simulador (demostración) y ESP32 real por Web Serial.
   ========================================================================== */
(function (global) {
  'use strict';

  var S = global.Store;

  var timer = null;
  var serial = { port: null, reader: null, buf: '', keepAlive: false };

  /* ---------------------------------------------------------------
     Simulador: reproduce el comportamiento térmico de una habitación
     --------------------------------------------------------------- */
  var sim = {
    temp: 26.2,
    hum: 55,
    rssi: -58
  };

  function simStep() {
    var now = Date.now();
    var hod = new Date(now).getHours() + new Date(now).getMinutes() / 60;
    // temperatura "externa" siguiendo el ciclo del día
    var ambient = 24 + Math.sin(((hod - 6) / 24) * Math.PI * 2 - Math.PI / 2) * 4.4;
    // deriva hacia la ambiente + ruido del sensor (DHT22)
    sim.temp += (ambient - sim.temp) * 0.16 + (Math.random() - .5) * 0.55;
    sim.hum += (56 - Math.sin(((hod - 6) / 24) * Math.PI * 2 - Math.PI / 2) * 7 - sim.hum) * 0.14
      + (Math.random() - .5) * 1.3;

    // deriva de RSSI para que la pantalla de conexión parezca viva
    sim.rssi = Math.round(-72 + Math.random() * 26);

    sim.temp = S.clamp(sim.temp, 12, 38);
    sim.hum = S.clamp(sim.hum, 25, 85);

    var rec = S.addReading(sim.temp, sim.hum);
    S.state.device.rssi = sim.rssi;
    return rec;
  }

  /* ---------------------------------------------------------------
     ESP32 real por Web Serial (Chrome / WebView con soporte)
     Protocolo JSON-lines:  {"t":26.3,"h":55,"auto":1,"fan":1}
     Salida:                 {"cmd":"fan","on":1}
     --------------------------------------------------------------- */
  async function serialConnect() {
    if (!navigator.serial) throw new Error('Web Serial no disponible en este dispositivo');
    serial.port = await navigator.serial.requestPort();
    await serial.port.open({ baudRate: 115200 });
    serial.keepAlive = true;
    while (serial.reader && serial.port.readable && serial.keepAlive) {
      serial.reader = serial.port.readable.getReader();
      try {
        while (true) {
          var res = await serial.reader.read();
          if (res.done) break;
          serial.buf += res.value;
          var lines = serial.buf.split('\n');
          serial.buf = lines.pop();
          lines.forEach(handleLine);
        }
      } catch (e) {
        if (!serial.keepAlive) break;
      } finally {
        try { serial.reader.releaseLock(); } catch (e2) {}
      }
    }
  }

  function handleLine(line) {
    line = line.trim();
    if (!line) return;
    var d;
    try { d = JSON.parse(line); } catch (e) { return; }
    var temp = (typeof d.t === 'number') ? d.t : (typeof d.temp === 'number' ? d.temp : null);
    var hum = (typeof d.h === 'number') ? d.h : (typeof d.hum === 'number' ? d.hum : null);
    if (temp === null || hum === null) return;
    S.state.mode = 'serial';
    if (d.id) S.state.device.id = String(d.id);
    if (typeof d.rssi === 'number') S.state.device.rssi = d.rssi;
    if (typeof d.fan === 'number') S.state.fan.on = !!d.fan;
    S.addReading(temp, hum);
  }

  function serialSendFan(on) {
    if (!serial.port || !serial.port.writable) return;
    var w = serial.port.writable.getWriter();
    w.write(new TextEncoder().encode(JSON.stringify({ cmd: 'fan', on: on ? 1 : 0 }) + '\n'))
      .then(function () { return w.close(); })
      .catch(function () {});
  }

  function serialDisconnect() {
    serial.keepAlive = false;
    if (serial.reader) { try { serial.reader.cancel(); } catch (e) {} }
    if (serial.port) { try { serial.port.close(); } catch (e) {} }
    serial.port = null; serial.reader = null;
    S.state.mode = 'sim';
  }

  /* ---------------------------------------------------------------
     Control del bucle de muestreo
     --------------------------------------------------------------- */
  function start() {
    stop();
    // lectura inmediata
    if (S.state.mode === 'sim') simStep();
    timer = setInterval(function () {
      if (S.state.mode === 'sim') simStep();
    }, Math.max(1, S.state.settings.interval) * 1000);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function pushFan(on) {
    S.state.fan.on = !!on;
    if (S.state.mode === 'serial') serialSendFan(S.state.fan.on);
    S.emit('fan', S.state.fan.on);
  }

  global.Sensor = {
    start: start,
    stop: stop,
    pushFan: pushFan,
    simStep: simStep,
    serialConnect: serialConnect,
    serialDisconnect: serialDisconnect,
    get sim() { return sim; },
    isSerial: function () { return S.state.mode === 'serial'; }
  };
})(window);