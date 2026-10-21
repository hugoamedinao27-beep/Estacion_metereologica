/* Cambia de vista en la app en ejecución y guarda una captura de cada una.
   Uso: node tools/shots.js [directorioDestino]                          */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 'http://localhost:9222';
const OUT = process.argv[2] || process.env.TEMP;
const SDK = process.env.LOCALAPPDATA + '\\Android\\Sdk';
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(PORT + '/json/list')).json();
  const page = list.find(p => p.type === 'page' && p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (method, params) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJS = expr => send('Runtime.evaluate', {
    expression: `(function(){try{return String(${expr});}catch(e){return 'ERR '+e;}})()`,
    returnByValue: true
  }).then(r => r.result?.result?.value);

  const VIEWS = [
    ['inicio', `document.querySelector('.tab[data-view="dashboard"]').click()`],
    ['historial', `document.querySelector('.tab[data-view="history"]').click()`],
    ['ajustes', `document.querySelector('.tab[data-view="settings"]').click()`],
    ['alerta-critica', `Store.addReading(34.1,63)`]
  ];

  for (const [name, expr] of VIEWS) {
    await evalJS(expr);
    await sleep(1600);
    const local = path.join(OUT, 'petsafe-' + name + '.png');
    execSync(`"${ADB}" shell screencap -p /sdcard/s.png`);
    execSync(`"${ADB}" pull /sdcard/s.png "${local}"`, { stdio: 'ignore' });
    console.log('  ' + local + '  (' + Math.round(fs.statSync(local).size / 1024) + ' KB)');
  }
  ws.close();
}
main().catch(e => { console.error(e); process.exit(1); });