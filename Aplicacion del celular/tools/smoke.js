/* Banco de pruebas end-to-end: se conecta al WebView de la app vía el
   protocolo DevTools de Chrome y comprueba el DOM en un dispositivo real.
   Uso:  node tools/smoke.js [http://localhost:9222]                    */
'use strict';

const PORT = process.argv[2] || 'http://localhost:9222';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const list = await (await fetch(PORT + '/json/list')).json();
  const page = list.find(p => p.type === 'page' && p.url.includes('localhost'));
  if (!page) throw new Error('No se encontró la página de PetSafe IoT');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];

  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && /error|warning/.test(msg.params.type)) {
      const parts = msg.params.args.map(a => {
        if ('value' in a) return typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value);
        if (a.description) return a.description;
        if (a.preview) {
          return (a.preview.properties || []).map(p => p.name + ':' + p.value).join(',') || a.preview.description;
        }
        return a.type;
      });
      logs.push('[console.' + msg.params.type + '] ' + parts.join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push('[EXCEPCIÓN] ' + (d.exception?.description || d.text));
    }
  });

  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  const send = (method, params) => new Promise(res => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Runtime.enable', {});
  await send('Page.enable', {});
  await sleep(1500); // deja que la app registre cualquier error al arrancar

  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: `(function(){ try { return JSON.stringify(${expr}); } catch(e) { return JSON.stringify({__err: String(e)}); } })()`,
      returnByValue: true, awaitPromise: true
    });
    const v = r.result?.result?.value;
    if (v === undefined) return { __evalError: JSON.stringify(r.result) };
    return JSON.parse(v);
  };

  const checks = [];
  const check = async (name, expr, want) => {
    const got = await evalJS(expr);
    if (got && typeof got === 'object' && got.__err) {
      checks.push([name, 'ERROR ' + got.__err, false]);
      return;
    }
    if (got && typeof got === 'object' && got.__evalError) {
      checks.push([name, 'EVAL ' + got.__evalError, false]);
      return;
    }
    const pass = typeof want === 'function' ? want(got) : got === want;
    checks.push([name, JSON.stringify(got), !!pass]);
  };

  console.log('\n=== Estructura del DOM ===');
  await check('título', 'document.title', 'PetSafe IoT');
  await check('vistas presentes', 'document.querySelectorAll(".view").length', 3);
  await check('pestañas', 'document.querySelectorAll(".tab").length', 3);
  await check('vista activa', 'Store.state.view', 'dashboard');
  await check('lecturas en memoria', 'Store.state.readings.length > 0', true);
  await check('eventos en memoria', 'Store.state.events.length > 0', true);

  console.log('\n=== Dashboard ===');
  await check('temperatura pintada', '/^-?\\d+(\\.\\d)?$/.test(document.getElementById("tempVal").textContent.replace("°C",""))', true);
  await check('humedad pintada', '/^\\d+%$/.test(document.getElementById("humVal").textContent)', true);
  await check('estado calculado', 'Object.keys(Store.STATES).indexOf(Store.state.currentState.key) >= 0', true);
  await check('tag de estado', 'document.getElementById("tempTag").textContent.length > 1', true);
  await check('banner con estado', 'document.getElementById("stateBanner").getAttribute("data-s")', s => !!s);
  await check('gráfico SVG', 'document.querySelectorAll("#chartHost svg path").length', p => p >= 2);
  await check('eje X con horas', 'document.getElementById("xAxis").children.length >= 4', true);
  await check('eje Y con grados', 'document.getElementById("yAxis").children.length', 3);
  await check('statsrellenas', 'document.getElementById("stAvg").textContent !== "—"', true);
  await check('ventilador visible', '!!document.getElementById("fanBtn")', true);

  console.log('\n=== Máquina de estados ===');
  await check('21°C -> NORMAL', 'Store.stateFor(21).key', 'NORMAL');
  await check('20°C -> FRIO', 'Store.stateFor(20).key', 'FRIO');
  await check('26°C -> NORMAL', 'Store.stateFor(26).key', 'NORMAL');
  await check('27°C -> CALOR', 'Store.stateFor(27).key', 'CALOR');
  await check('28°C -> CRITICO', 'Store.stateFor(28).key', 'CRITICO');
  await check('35°C -> CRITICO', 'Store.stateFor(35).key', 'CRITICO');

  console.log('\n=== Navegación ===');
  await evalJS('document.querySelector(\'.tab[data-view="history"]\').click()');
  await sleep(400);
  await check('vista historial', 'Store.state.view', 'history');
  await check('filas en el log', 'document.querySelectorAll("#logList li.log-day, #logList li").length > 0', true);
  await check('contador visible', 'document.getElementById("logCount").textContent', n => parseInt(n) > 0);

  await evalJS('document.querySelector(\'.tab[data-view="settings"]\').click()');
  await sleep(400);
  await check('vista ajustes', 'Store.state.view', 'settings');
  await check('zonas pintadas', 'document.querySelectorAll("#zones .zone").length', 4);
  await check('leyenda 4 estados', 'document.querySelectorAll("#stateLegend li").length', 4);
  await check('toggles', 'document.querySelectorAll(".toggle[data-opt]").length', 5);
  await check('auto activado', 'Store.state.settings.opts.auto', true);
  await check('futuras desactivadas', 'Store.state.settings.opts.ir + "," + Store.state.settings.opts.water', 'false,false');
  await check('futuras bloqueadas', 'document.querySelectorAll(".toggle[disabled]").length', 2);

  console.log('\n=== Interacción: límites y actuator ===');
  await evalJS('(function(){var s=document.getElementById("slCrit"); s.value=31; s.dispatchEvent(new Event("input")); return s.value;})()');
  await sleep(300);
  await check('umbral crit -> 31', 'Store.state.settings.limits.crit', 31);
  await check('30°C es CALOR con crit=31', 'Store.stateFor(30).key', 'CALOR');
  await check('31°C es CRÍTICO con crit=31', 'Store.stateFor(31).key', 'CRITICO');
  await check('etiqueta del slider', 'document.getElementById("outCrit").textContent', '31°C');
  await check('zonas recalculadas', 'document.querySelector("#zones").children[3].title', t => String(t).indexOf('28') === -1);
  await evalJS('(function(){var s=document.getElementById("slCrit"); s.value=28; s.dispatchEvent(new Event("input")); return s.value;})()');
  await sleep(200);

  await evalJS('document.getElementById("btnApply").click()');
  await sleep(500);
  await check('aplicar sin error', 'Store.state.settings.limits.crit', 28);

  console.log('\n=== Alerta crítica (hoja emergente) ===');
  await evalJS('Store.addReading(33.4, 61)');
  await sleep(700);
  await check('estado CRITICO', 'Store.state.currentState.key', 'CRITICO');
  await check('hoja visible', 'document.getElementById("sheetWrap").hidden', false);
  await check('título de la alerta', 'document.getElementById("shTitle").textContent', '¡ALERTA URGENTE!');
  await check('evento registrado', 'Store.state.events[0].state', 'CRITICO');
  await check('ventilador encendido', 'Store.state.fan.on', true);
  await check('insignia en historial', '!!document.querySelector(\'.tab[data-view="history"] .badge\')', true);
  await evalJS('document.getElementById("shOpen").click()');
  await sleep(400);
  await check('ir al registro', 'Store.state.view', 'history');
  await check('hoja cerrada', 'document.getElementById("sheetWrap").hidden', true);

  console.log('\n=== Manual: ventilador y persistencia ===');
  await evalJS('(function(){Store.applySettings({opts:{auto:false}}); Sensor.pushFan(true); return Store.state.fan.on;})()');
  await sleep(300);
  await check('manual ON', 'Store.state.fan.on', true);
  await check('UI refleja ON', 'document.getElementById("powerChip").textContent', 'ON');
  await evalJS('(function(){Sensor.pushFan(false); return Store.state.fan.on;})()');
  await sleep(200);
  await check('manual OFF', 'Store.state.fan.on', false);
  await evalJS('(function(){Store.applySettings({opts:{auto:true}}); return Store.state.settings.opts.auto;})()');

  const before = await evalJS('localStorage.length > 0');
  checks.push(['persistencia en localStorage', JSON.stringify(before), before === true]);

  console.log('\n=== CSV ===');
  const csv = await evalJS('Store.toCSV().split("\\n").slice(0,3)');
  checks.push(['cabecera CSV', JSON.stringify(csv[0]), String(csv[0]).startsWith('fecha_hora;estado')]);
  checks.push(['filas CSV', String(csv.length), csv.length >= 2]);

  /* ---------------- resultado ---------------- */
  const w = Math.max(...checks.map(c => c[0].length));
  console.log('\n=== RESULTADOS (' + checks.length + ' comprobaciones) ===');
  let fails = 0;
  checks.forEach(([n, v, ok]) => {
    if (!ok) fails++;
    console.log((ok ? '  OK   ' : '  FALLA') + '  ' + n.padEnd(w) + '  ' + v);
  });

  if (logs.length) {
    console.log('\n=== Consola del WebView ===');
    logs.slice(0, 20).forEach(l => console.log('  ' + l));
  } else {
    console.log('\nConsola del WebView: sin errores ni excepciones.');
  }

  console.log('\n' + (fails ? 'FALLOS: ' + fails : 'TODO CORRECTO: ' + checks.length + ' comprobaciones') + '\n');
  ws.close();
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(2); });