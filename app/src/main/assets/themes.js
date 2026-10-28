/* ════════════════════════════════════════════════════════════════════
   TEMAS — cada um muda 4 coisas ao mesmo tempo:
     1) o MAPA (cores de cada camada, prédios 3D ou chapados, brilho das ruas)
     2) a INTERFACE (cores/fontes/formato dos painéis → ver style.css, body[data-theme])
     3) o SOM dos avisos (timbre e notas do "piririn")
     4) os TEXTOS da abertura
   Os temas são "inspirados em" estilos de jogos — nenhum logo ou arte original é usada.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

const THEMES = {
  nightcity: {
    sky: { sky: '#05070f', horizon: '#ff2a4d', fog: '#0a1622' }, light: { color: '#ff9aa8', intensity: 0.45 },
    name: 'Night City', tag: 'Cyberpunk · neon vermelho e ciano',
    preview: 'linear-gradient(135deg,#3a0911 0 40%,#2fc6ff 40% 46%,#3a0911 46% 70%,#d4243d 70%)',
    boot: { title: 'NIGHTCITY//NAV', sub: 'SETOR: HORTOLÂNDIA · SP', btn: 'JACK IN',
            log: ['> carregando kiroshi optics...', '> sincronizando satélites...', '> renderizando a cidade em 3D...', '> radar.daemon ONLINE', '> pronto, choom.'] },
    map: { bg: '#0a1622', land: '#3a0911', landHi: '#560c19', park: '#0a2129', water: '#061a2f',
           road: '#2fc6ff', roadMid: '#1a95c9', roadMinor: '#12607f', roadCase: '#02060c', glow: '#00a8ff',
           bldg: ['#5e0d1a', '#d4243d'], bldgLine: null, label: '#7fe3f2', roadLabel: '#a8e6ff', halo: '#02060c',
           border: '#39ff88', rail: '#3a4a5a' },
    glow: true, extrude: true, roadScale: 1, upcase: true, fonts: { r: ['Noto Sans Regular'], b: ['Noto Sans Bold'] },
    route: { core: '#fff1d6', glow: '#ff9a3c', dash: null }, player: '#39ff88', zone: '#ff2a6d', signal: '#fcee0a',
    sound: { wave: 'square', notes: [1318, 1568, 2093], dur: 0.085, gap: 0.035, decay: 0.08 },
  },
  netrunner: {
    sky: { sky: '#03050a', horizon: '#00b8d4', fog: '#05080e' }, light: { color: '#9ff6ff', intensity: 0.45 },
    name: 'Netrunner', tag: 'Cyberpunk · magenta e ciano',
    preview: 'linear-gradient(135deg,#0a1a24 0 40%,#ff2a6d 40% 46%,#0a1a24 46% 70%,#18c4d8 70%)',
    boot: { title: 'NETRUNNER//NAV', sub: 'CONEXÃO: HORTOLÂNDIA · SP', btn: 'CONECTAR',
            log: ['> abrindo deck neural...', '> quebrando ICE do GPS...', '> mapeando a rede da cidade...', '> daemon de radares carregado', '> você está dentro.'] },
    map: { bg: '#05080e', land: '#0a1a24', landHi: '#0e2733', park: '#06180f', water: '#040f1c',
           road: '#ff2a6d', roadMid: '#c41f57', roadMinor: '#5c1531', roadCase: '#02060c', glow: '#ff2a6d',
           bldg: ['#0f2c3a', '#18c4d8'], bldgLine: null, label: '#ffd1e0', roadLabel: '#ffa3c2', halo: '#02060c',
           border: '#fcee0a', rail: '#3a2a3a' },
    glow: true, extrude: true, roadScale: 1, upcase: true, fonts: { r: ['Noto Sans Regular'], b: ['Noto Sans Bold'] },
    route: { core: '#e8fbff', glow: '#00f0ff', dash: null }, player: '#00f0ff', zone: '#fcee0a', signal: '#00f0ff',
    sound: { wave: 'sawtooth', notes: [988, 1319, 1976], dur: 0.08, gap: 0.03, decay: 0.07 },
  },
  western: {
    sky: { sky: '#f4e4bf', horizon: '#e3c48a', fog: '#e9d8b0' }, light: { color: '#ffe2b0', intensity: 0.4 },
    name: 'Velho Oeste', tag: 'Mapa de papel antigo · tinta e sépia',
    preview: 'linear-gradient(135deg,#e6d3a8 0 40%,#4a3220 40% 43%,#dcc392 43% 70%,#9db3a6 70%)',
    boot: { title: 'Hortolândia', sub: 'Mapa do Território · Anno MMXXVI', btn: 'Selar o cavalo',
            log: ['~ desdobrando o mapa...', '~ conferindo a bússola...', '~ marcando as estradas...', '~ xerife avisa: cuidado com os radares', '~ pé na estrada, parceiro.'] },
    map: { bg: '#e9d8b0', land: '#dfc795', landHi: '#d4b57c', park: '#b8b68a', water: '#9db3a6',
           road: '#5a3a22', roadMid: '#6e4a2c', roadMinor: '#8a6a48', roadCase: '#efe2c0', glow: '#000000',
           bldg: ['#c9a675', '#7e5a36'], bldgLine: '#7a5a34', label: '#3b2a1a', roadLabel: '#4a3220', halo: '#efe2c0',
           border: '#8b1a1a', rail: '#3b2a1a' },
    glow: false, extrude: true, roadScale: 0.7, upcase: false, fonts: { r: ['Noto Sans Italic'], b: ['Noto Sans Bold'] },
    route: { core: '#9b1c1c', glow: '#9b1c1c', dash: [2, 1.4] }, player: '#8b1a1a', zone: '#8b1a1a', signal: '#3b2a1a',
    sound: { wave: 'sine', notes: [784, 1046, 1318], dur: 0.32, gap: 0.04, decay: 0.45, bell: true },
  },
  royale: {
    sky: { sky: '#6cc6ff', horizon: '#e4f6ff', fog: '#c4e9ff' }, light: { color: '#ffffff', intensity: 0.3 },
    name: 'Battle Royale', tag: 'Cartoon colorido · cores vivas',
    preview: 'linear-gradient(135deg,#6cc24a 0 40%,#ffffff 40% 46%,#7cc95b 46% 70%,#2fa3f0 70%)',
    boot: { title: 'BATTLE NAV', sub: 'ZONA DE POUSO: HORTOLÂNDIA', btn: 'SALTAR!',
            log: ['» abrindo o paraquedas...', '» escolhendo o ponto de pouso...', '» construindo a cidade...', '» a zona está fechando nos radares', '» bora, bora, bora!'] },
    map: { bg: '#5cb547', land: '#7cc95b', landHi: '#e9d8a6', park: '#3e9a3a', water: '#2fa3f0',
           road: '#ffffff', roadMid: '#fbf6e9', roadMinor: '#f1ead6', roadCase: '#2a3d55', glow: '#000000',
           bldg: ['#ffd98a', '#7fd0ff'], bldgLine: null, label: '#ffffff', roadLabel: '#2a3d55', halo: '#1b1b3a',
           border: '#9d4dff', rail: '#6b5a48' },
    glow: false, extrude: true, roadScale: 1.1, upcase: true, fonts: { r: ['Noto Sans Bold'], b: ['Noto Sans Bold'] },
    route: { core: '#ffe14d', glow: '#9d4dff', dash: null }, player: '#22c7ff', zone: '#9d4dff', signal: '#ffe14d',
    sound: { wave: 'triangle', notes: [1047, 1319, 1568, 2093], dur: 0.07, gap: 0.025, decay: 0.07 },
  },
  vigilante: {
    sky: { sky: '#060910', horizon: '#3b4d6b', fog: '#0b1018' }, light: { color: '#a9c2ff', intensity: 0.55 },
    name: 'Vigilante', tag: 'Cidade gótica à noite · azul e âmbar',
    preview: 'linear-gradient(135deg,#141b26 0 40%,#ffb000 40% 44%,#1b2433 44% 70%,#4a5a70 70%)',
    boot: { title: 'VIGILANTE', sub: 'PATRULHA NOTURNA · HORTOLÂNDIA', btn: 'INICIAR PATRULHA',
            log: ['// conectando ao computador do carro...', '// varredura da cidade em andamento...', '// modelo 3D dos prédios carregado...', '// rede de radares sob vigilância', '// a noite é sua.'] },
    map: { bg: '#090d14', land: '#121925', landHi: '#18212f', park: '#0d1716', water: '#04080f',
           road: '#a9c0dc', roadMid: '#5c7192', roadMinor: '#344459', roadCase: '#05080d', glow: '#4f9dff',
           bldg: ['#1a2231', '#56677f'], bldgLine: null, label: '#d3deec', roadLabel: '#8fa3bd', halo: '#05080d',
           border: '#ffb000', rail: '#2a3446' },
    glow: true, extrude: true, roadScale: 0.9, upcase: true, fonts: { r: ['Noto Sans Regular'], b: ['Noto Sans Bold'] },
    route: { core: '#ffd25a', glow: '#ff8a00', dash: null }, player: '#ffb000', zone: '#ff3b3b', signal: '#ffb000',
    sound: { wave: 'sawtooth', notes: [659, 880, 1175], dur: 0.09, gap: 0.04, decay: 0.12 },
  },
};

/* Monta o estilo do mapa (formato MapLibre) para um tema.
   O mapa chega em VETOR (camadas: landuse, water, transportation, building, place...) e aqui
   decidimos a cor/largura/altura de cada uma. */
function buildStyle(T, src, glyphs, opt) {
  const P = T.map, cls = ['get', 'class'], s = T.roadScale;
  // Largura por zoom (exponencial base 1,6): a cada nível de zoom a escala do mapa dobra,
  // e as ruas crescem ~1,6× para não ficarem finas demais nem engolirem o mapa.
  const W = (k) => ['interpolate', ['exponential', 1.6], ['zoom'],
    12, ['match', cls, 'motorway', 2.2 * k, 'trunk', 2 * k, 'primary', 1.6 * k, 'secondary', 1.3 * k, 'tertiary', 1 * k, 'minor', .6 * k, .3 * k],
    18, ['match', cls, 'motorway', 24 * k, 'trunk', 22 * k, 'primary', 17 * k, 'secondary', 15 * k, 'tertiary', 12 * k, 'minor', 9 * k, 4 * k]];
  const roads = ['match', cls, ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track'], true, false];
  const roadColor = ['match', cls, ['motorway', 'trunk', 'primary'], P.road, ['secondary', 'tertiary'], P.roadMid, P.roadMinor];
  const height = ['coalesce', ['get', 'render_height'], 6];       // sem altura cadastrada → 6 m (sobrado)
  const L = (id, type, layer, extra) => Object.assign({ id, type, source: 'omt', 'source-layer': layer }, extra);
  const cap = { 'line-cap': 'round', 'line-join': 'round' };
  const layers = [
    { id: 'bg', type: 'background', paint: { 'background-color': P.bg } },
    L('landuse', 'fill', 'landuse', { filter: ['match', cls, ['residential', 'commercial', 'retail', 'industrial', 'neighbourhood', 'suburb', 'quarter', 'garages', 'railway'], true, false],
      paint: { 'fill-color': ['match', cls, ['commercial', 'retail', 'industrial'], P.landHi, P.land], 'fill-opacity': 0.92 } }),
    L('landcover', 'fill', 'landcover', { filter: ['match', cls, ['grass', 'wood', 'farmland', 'wetland', 'scrub'], true, false], paint: { 'fill-color': P.park, 'fill-opacity': 0.75 } }),
    L('park', 'fill', 'park', { paint: { 'fill-color': P.park } }),
    L('water', 'fill', 'water', { paint: { 'fill-color': P.water, 'fill-outline-color': P.roadCase } }),
    L('waterway', 'line', 'waterway', { paint: { 'line-color': P.water, 'line-width': 2 } }),
    L('boundary', 'line', 'boundary', { filter: ['<=', ['to-number', ['get', 'admin_level']], 8],
      paint: { 'line-color': P.border, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': T.glow ? [1, 0] : [4, 2] } }),
    L('rail', 'line', 'transportation', { filter: ['match', cls, ['rail', 'transit'], true, false],
      paint: { 'line-color': P.rail, 'line-width': 2, 'line-dasharray': [3, 2] } }),
  ];
  if (T.glow) layers.push(
    L('road-glow', 'line', 'transportation', { filter: roads, layout: cap,
      paint: { 'line-color': P.glow, 'line-width': W(2.4 * s), 'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 16], 'line-opacity': 0.3 } }),
    // brilho extra só nas vias principais → as avenidas "acendem" como no mapa do jogo
    L('road-glow-major', 'line', 'transportation', { filter: ['match', cls, ['motorway', 'trunk', 'primary'], true, false], layout: cap,
      paint: { 'line-color': P.glow, 'line-width': W(4 * s), 'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 4, 18, 30], 'line-opacity': 0.22 } }));
  if (!T.glow) layers.push(L('road-shadow', 'line', 'transportation', { filter: roads, layout: cap,
      paint: { 'line-color': '#000000', 'line-width': W(1.6 * s), 'line-blur': 3, 'line-opacity': 0.12, 'line-translate': [1.5, 2] } }));
  layers.push(
    L('road-case', 'line', 'transportation', { filter: roads, layout: cap, paint: { 'line-color': P.roadCase, 'line-width': W(1.35 * s) } }),
    L('road', 'line', 'transportation', { filter: roads, layout: cap, paint: { 'line-color': roadColor, 'line-width': W(s) } }),
  );
  const flat = { 'fill-color': P.bldg[0] }; if (P.bldgLine) flat['fill-outline-color'] = P.bldgLine;
  if (T.extrude && opt.buildings3d) {
    layers.push(L('bldg-flat', 'fill', 'building', { maxzoom: 14.5, paint: flat }),
      // prédio 3D: cor interpolada pela altura (baixo → cor 1, 40 m ou mais → cor 2)
      L('bldg-3d', 'fill-extrusion', 'building', { minzoom: 14, paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], height, 0, P.bldg[0], 40, P.bldg[1]],
        'fill-extrusion-height': height, 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.93 } }));
  } else layers.push(L('bldg-flat', 'fill', 'building', { paint: flat }));
  const nameExpr = ['coalesce', ['get', 'name:pt'], ['get', 'name']];
  layers.push(
    L('road-label', 'symbol', 'transportation_name', { minzoom: 14.5,
      layout: { 'symbol-placement': 'line', 'text-field': nameExpr, 'text-font': T.fonts.r, 'text-size': 11, 'text-letter-spacing': 0.05 },
      paint: { 'text-color': P.roadLabel, 'text-halo-color': P.halo, 'text-halo-width': 1.5 } }),
    L('place-label', 'symbol', 'place', { filter: ['match', cls, ['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter', 'hamlet'], true, false],
      layout: { 'text-field': T.upcase ? ['upcase', ['get', 'name']] : ['get', 'name'], 'text-font': T.upcase ? T.fonts.b : T.fonts.r,
                'text-size': ['match', cls, ['city', 'town'], 18, 'suburb', 14, 12], 'text-letter-spacing': T.upcase ? 0.16 : 0.04, 'text-max-width': 8 },
      paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': T.id === 'royale' ? 2.6 : 2 } }),
  );
  // céu + neblina no horizonte (aparecem quando a câmera inclina) e luz que ilumina as faces dos prédios
  const sky = { 'sky-color': T.sky.sky, 'horizon-color': T.sky.horizon, 'fog-color': T.sky.fog,
                'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.6, 'atmosphere-blend': 0.8 };
  const light = { anchor: 'viewport', position: [1.2, 210, 35], color: T.light.color, intensity: T.light.intensity };
  return { version: 8, glyphs, sources: { omt: src }, sky, light, layers };
}
for (const k in THEMES) THEMES[k].id = k;
