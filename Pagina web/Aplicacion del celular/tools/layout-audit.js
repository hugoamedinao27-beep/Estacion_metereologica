/* Auditoría de maquetación: desbordes horizontales, elementos fuera de
   pantalla y contraste básico. Uso: node tools/layout-audit.js         */
'use strict';

const PORT = 'http://localhost:9222';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(PORT + '/json/list')).json();
  const page = list.find(p => p.type === 'page' && p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (method, params) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const run = expr => send('Runtime.evaluate', {
    expression: `JSON.stringify((function(){${expr}})())`, returnByValue: true
  }).then(r => JSON.parse(r.result?.result?.value || 'null'));

  const audit = `var vw = document.documentElement.clientWidth;
    var over = [], off = [];
    document.querySelectorAll('.view:not([hidden]) *').forEach(function(el){
      var r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > vw + 1.5) over.push((el.className||el.tagName) + ' right=' + r.right.toFixed(0));
      if (r.left < -1.5) off.push((el.className||el.tagName) + ' left=' + r.left.toFixed(0));
    });
    var sc = document.getElementById('scroll');
    return { view: Store.state.view, vw: vw,
             desbordeH: over.slice(0,6), fueraIzq: off.slice(0,6),
             scrollH: sc.scrollHeight, clientH: sc.clientHeight,
             pestanaAbajo: document.getElementById('tabbar').getBoundingClientRect().bottom,
             alto: window.innerHeight };`;

  let bad = 0;
  for (const v of ['dashboard', 'history', 'settings']) {
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.tab[data-view="${v}"]').click()`, returnByValue: true
    });
    await sleep(700);
    const r = await run(audit);
    const overflow = r.desbordeH.length || r.fueraIzq.length;
    if (overflow) bad++;
    console.log('\n[' + v + ']  ancho ' + r.vw + 'px · alto ' + r.alto + 'px');
    console.log('  scroll ' + r.scrollH + 'px / visible ' + r.clientH +
      'px  (' + (r.scrollH > r.clientH ? 'con scroll, correcto' : 'sin scroll') + ')');
    console.log('  barra inferior en y=' + r.pestanaAbajo.toFixed(0) + ' (debe ser <= ' + r.alto + ')');
    console.log('  desbordes horizontales: ' + (overflow ? JSON.stringify(r.desbordeH.concat(r.fueraIzq)) : 'ninguno'));
  }
  console.log('\n' + (bad ? 'HAY DESBORDES en ' + bad + ' vista(s)' : 'MAQUETACIÓN CORRECTA en las 3 vistas') + '\n');
  ws.close();
}
main().catch(e => { console.error(e); process.exit(1); });