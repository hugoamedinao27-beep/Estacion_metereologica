// Ejecutar con: node --test tests/regression.test.cjs
// Sin dependencias: comprueba la lógica y los fallos que afectaban a la demo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const keys = { config: 'meteoguard_config_v2', readings: 'meteoguard_readings_v2', geo: 'meteoguard_geo_clima' };
const defaults = { coldThreshold: 15, cautionThreshold: 25, calorThreshold: 28, criticalThreshold: 30 };
const reading = { temperature: 29, humidity: 50, timestamp: '2026-10-27T18:00:00.000Z', state: 'Calor' };

function element(id) {
  const attributes = {};
  const classes = new Set();
  return { id, value: '', textContent: '', innerHTML: '', hidden: true, disabled: false, style: {}, listeners: {},
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), toggle(c) {
      if (classes.has(c)) { classes.delete(c); return false; } classes.add(c); return true;
    } },
    setAttribute: (k, v) => { attributes[k] = v; }, getAttribute: k => attributes[k],
    removeAttribute: k => { delete attributes[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    querySelector() { return this.submit || (this.submit = element('submit')); },
    appendChild() {}
  };
}

function load(options = {}) {
  const storage = new Map(Object.entries(options.storage || {}));
  const nodes = new Map([...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)]
    .map(match => [match[1], element(match[1])]));
  const intervals = [];
  const context = vm.createContext({ window: { localStorage: {
    getItem(key) { if (options.blocked) throw new Error('blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (options.blocked) throw new Error('blocked'); storage.set(key, value); }
  } }, document: { getElementById: id => nodes.get(id), documentElement: element('html'),
    addEventListener() {}, createElement: tag => element(tag) }, navigator: {}, console,
    setInterval: (fn, ms) => intervals.push({ fn, ms }),
    setTimeout: options.setTimeout || setTimeout, clearTimeout, AbortController,
    fetch: options.fetch || (async () => { throw new Error('offline'); }) });
  if (options.Chart) context.Chart = options.Chart;
  function run(relative) { vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative }); }
  run('js/models/weatherModel.js');
  run('js/views/weatherView.js');
  const Model = context.window.MeteoGuard.Model;
  const View = context.window.MeteoGuard.View;
  function controller() {
    Model.getLastSearchedCity = () => '';
    run('js/controllers/weatherController.js');
    return context.window.MeteoGuard.Controller;
  }
  return { Model, View, nodes, storage, intervals, controller };
}

function weather() {
  return { current: { temperature_2m: 18, apparent_temperature: 17, relative_humidity_2m: 60, wind_speed_10m: 12, weather_code: 0 },
    daily: { time: ['2026-10-27', '2026-10-28'], weather_code: [0, 1], temperature_2m_max: [20, 21],
      temperature_2m_min: [10, 11], precipitation_probability_max: [0, null] } };
}

test('rechaza campos vacíos, valores no numéricos, decimales, rangos y orden incorrectos', () => {
  const { Model } = load();
  for (const value of ['', '  ', null, undefined, NaN, Infinity, true, 15.1, -1, 41]) {
    assert.equal(Model.validateThresholds({ ...defaults, coldThreshold: value }).isValid, false, String(value));
  }
  assert.equal(Model.validateThresholds({ ...defaults, cautionThreshold: 14 }).isValid, false);
  assert.equal(Model.validateThresholds({ ...defaults, criticalThreshold: 66 }).isValid, false);
  assert.equal(Model.validateThresholds({ coldThreshold: '2', cautionThreshold: '10', calorThreshold: '20', criticalThreshold: '30' }).isValid, true);
});

test('el formulario conserva el vacío hasta que el modelo lo valida', () => {
  const { Model, View, nodes } = load();
  View.fillThresholdsForm(defaults);
  for (const key of Object.keys(defaults)) nodes.get(key).value = String(defaults[key]);
  nodes.get('coldThreshold').value = '';
  const values = View.readThresholdsForm();
  assert.equal(values.coldThreshold, '');
  assert.equal(Model.validateThresholds(values).isValid, false);
});

test('cada botón produce su estado con límites extremos e intervalos de un grado', async () => {
  const { Model } = load();
  for (const config of [defaults,
    { coldThreshold: 0, cautionThreshold: 1, calorThreshold: 2, criticalThreshold: 3 },
    { coldThreshold: 40, cautionThreshold: 50, calorThreshold: 60, criticalThreshold: 65 },
    { coldThreshold: 15, cautionThreshold: 25, calorThreshold: 26, criticalThreshold: 27 }]) {
    await Model.saveConfig(config);
    for (const [button, state] of Object.entries({ cold: 'Frio', normal: 'Normal', warn: 'Precaucion', hot: 'Calor', critical: 'Critico' })) {
      assert.equal((await Model.simulateState(button)).state, state, `${button}: ${JSON.stringify(config)}`);
    }
  }
});

test('los límites exactos clasifican correctamente', async () => {
  const { Model } = load();
  for (const [temp, state] of [[14.9, 'Frio'], [15, 'Normal'], [24.9, 'Normal'], [25, 'Precaucion'], [28, 'Calor'], [30, 'Critico']]) {
    assert.equal((await Model.simulateTick(temp, 50)).state, state);
  }
});

test('la barra se limita al 100 %, pero el texto informa el porcentaje real', () => {
  const { Model } = load();
  assert.equal(Model.calculateGauges({ temperature: 45, humidity: 50 }).tempPercent, 100);
  assert.match(Model.calculateGauges({ temperature: 45, humidity: 50 }).tempRatioText, /150%/);
  assert.equal(Model.calculateGauges({ temperature: -3, humidity: 50 }).tempPercent, 0);
});

test('recupera configuración inválida y descarta lecturas dañadas', async () => {
  const { Model } = load({ storage: { [keys.config]: JSON.stringify({ ...defaults, criticalThreshold: 0 }),
    [keys.readings]: JSON.stringify([null, {}, { ...reading, humidity: 200 }, { ...reading, timestamp: 'bad' }, reading]) } });
  assert.equal((await Model.loadConfig()).criticalThreshold, 30);
  const readings = await Model.loadReadings();
  assert.equal(readings.length, 1);
  assert.equal(Model.calculateKPIs(readings).maxTemp, '29.0 °C');
  assert.equal(Model.getStorageStatus().recovered, true);
});

test('tolera JSON roto y no sobrescribe umbrales activos con una configuración inválida', async () => {
  const { Model } = load({ storage: { [keys.config]: '{', [keys.readings]: '{' } });
  await Model.loadConfig();
  assert.equal((await Model.loadReadings()).length, 0);
  await assert.rejects(Model.saveConfig({ ...defaults, coldThreshold: '' }), /no son válidos/);
  assert.equal(Model.getCurrentConfig().coldThreshold, 15);
});

test('almacenamiento bloqueado: avisa, conserva los límites anteriores y sigue simulando', async () => {
  const { Model } = load({ blocked: true });
  await assert.rejects(Model.saveConfig({ ...defaults, coldThreshold: 10 }), /anteriores siguen activos/);
  assert.equal(Model.getCurrentConfig().coldThreshold, 15);
  await Model.simulateTick(22, 50);
  assert.equal((await Model.loadReadings()).length, 1);
  assert.equal(Model.getStorageStatus().failed, true);
});

test('mantiene 120 lecturas, las recupera y reclasifica al cambiar umbrales', async () => {
  const { Model, storage } = load();
  for (let i = 0; i < 125; i++) await Model.simulateTick(29, 50);
  await Model.saveConfig({ coldThreshold: 15, cautionThreshold: 25, calorThreshold: 27, criticalThreshold: 28 });
  assert.equal((await Model.loadReadings()).length, 120);
  assert.equal((await Model.loadReadings())[0].state, 'Critico');
  const restored = load({ storage: Object.fromEntries(storage) }).Model;
  await restored.loadConfig();
  assert.equal((await restored.loadReadings())[0].state, 'Critico');
});

test('caché GPS: acepta datos recientes y rechaza datos antiguos o incompletos', () => {
  const data = { place: 'Puerto Montt', temp: 18, feels: 17, humidity: 60, wind: 12, code: 0, updated: Date.now() - 1000 };
  assert.equal(load({ storage: { [keys.geo]: JSON.stringify(data) } }).Model.getCachedGeoWeather().place, 'Puerto Montt');
  for (const invalid of [{}, { ...data, updated: Date.now() - 31 * 60000 }, { ...data, temp: null }]) {
    assert.equal(load({ storage: { [keys.geo]: JSON.stringify(invalid) } }).Model.getCachedGeoWeather(), null);
  }
});

test('consulta por ciudad: datos válidos y precipitación desconocida', async () => {
  const { Model } = load({ fetch: async url => ({ ok: true, json: async () => url.includes('geocoding-api')
    ? { results: [{ name: 'Lima', country: 'Perú', latitude: -12, longitude: -77 }] } : weather() }) });
  const result = await Model.fetchCityWeather('Lima');
  assert.equal(result.locationName, 'Lima, Perú');
  assert.equal(result.daily.precipitation_probability_max[1], null);
});

test('rechaza respuestas incompletas, ciudades inexistentes y errores HTTP', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
    await assert.rejects(load({ fetch: async () => response }).Model.fetchCityWeather('Ciudad'));
  }
  const { Model } = load({ fetch: async url => ({ ok: true, json: async () => url.includes('geocoding-api')
    ? { results: [{ name: 'Lima', latitude: -12, longitude: -77 }] } : { current: {} } }) });
  await assert.rejects(Model.fetchCityWeather('Lima'), /incompletos/);
});

test('la consulta cancela la espera si el servicio no responde', async () => {
  const { Model } = load({ setTimeout: fn => setTimeout(fn, 5), fetch: (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  await assert.rejects(Model.fetchCityWeather('Lima'), /aborted/);
});

test('si falla Nominatim, el clima por coordenadas sigue disponible', async () => {
  const { Model } = load({ fetch: async url => {
    if (url.includes('nominatim')) throw new Error('offline');
    return { ok: true, json: async () => weather() };
  } });
  assert.equal((await Model.fetchWeatherByCoords(-41.5, -72.9)).temp, 18);
  await assert.rejects(Model.fetchWeatherByCoords(100, -72.9), /Coordenadas/);
});

test('sin Chart.js, el inicio, la tabla y ambos temporizadores siguen funcionando', async () => {
  const app = load();
  await app.controller().init();
  assert.deepEqual(app.intervals.map(i => i.ms), [8000, 5000]);
  assert.match(app.nodes.get('historyBody').innerHTML, /°C/);
  assert.equal(app.nodes.get('liveChartMessage').hidden, false);
  assert.equal(app.nodes.get('historyChartMessage').hidden, false);
  const before = (await app.Model.loadReadings()).length;
  await app.intervals[0].fn();
  assert.equal((await app.Model.loadReadings()).length, before + 1);
});

test('un error interno del gráfico tampoco interrumpe la tabla ni el inicio', async () => {
  const app = load({ Chart: function () { throw new Error('canvas error'); } });
  await app.controller().init();
  assert.equal(app.intervals.length, 2);
  assert.match(app.nodes.get('historyBody').innerHTML, /°C/);
  assert.equal(app.nodes.get('liveChartMessage').hidden, false);
});

test('GPS denegado no deja mensajes de carga; el dato anterior conserva su fecha', () => {
  const { View, Model, nodes } = load();
  View.setGeoStatus('Permiso GPS denegado', false);
  assert.equal(nodes.get('homeGeoLoc').textContent, '📍 Ubicación no disponible');
  assert.equal(nodes.get('homeGeoRefresh').disabled, false);
  View.renderUnifiedGeoCard({ place: 'Puerto Montt', temp: 18, humidity: 60, feels: 17, wind: 12, code: 0, updated: Date.now() }, Model.getWeatherMetadata);
  View.setGeoStatus('GPS no disponible', false);
  assert.match(nodes.get('homeGeoNote').textContent, /Último dato:/);
  assert.match(nodes.get('homeGeoLoc').textContent, /Puerto Montt/);
});

test('una respuesta antigua no reemplaza ni guarda otra ciudad ni termina su carga', async () => {
  const app = load();
  const pending = {};
  const rendered = [];
  const loading = [];
  app.Model.fetchCityWeather = city => new Promise((resolve, reject) => { pending[city] = { resolve, reject }; });
  app.View.renderCityWeather = data => rendered.push(data.locationName);
  app.View.setCitySearchLoading = value => loading.push(value);
  await app.controller().init();
  const click = city => app.nodes.get('citySuggestions').listeners.click({ target: { closest: () => ({ getAttribute: () => city }) } });
  click('Madrid'); click('Lima');
  pending.Madrid.resolve({ locationName: 'Madrid' });
  await new Promise(setImmediate);
  assert.deepEqual(rendered, []);
  assert.equal(loading.at(-1), true);
  pending.Lima.resolve({ locationName: 'Lima' });
  await new Promise(setImmediate);
  assert.deepEqual(rendered, ['Lima']);
  assert.equal(app.storage.get('meteoguard_last_city'), 'Lima');
  click('Madrid'); click('Lima');
  pending.Lima.resolve({ locationName: 'Lima' });
  await new Promise(setImmediate);
  pending.Madrid.reject(new Error('late error'));
  await new Promise(setImmediate);
  assert.deepEqual(rendered, ['Lima', 'Lima']);
  assert.equal(loading.at(-1), false);
});
