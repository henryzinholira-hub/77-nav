/* ════════════════════════════════════════════════════════════════════
   NIGHTCITY//NAV v2 — mapa 3D estilo Cyberpunk 2077
   ────────────────────────────────────────────────────────────────────
   Peças (pense num carro de Night City):
     🛰  GPS ............ os "olhos"   → onde estou, a que velocidade, pra onde aponto
     🗺  MapLibre 3D .... o "para-brisa" → mapa vetorial com prédios em 3D, câmera inclinada
     ◉  Overpass (OSM) . o "informante" → desenho das ruas, semáforos e câmeras cadastradas
     📰 Lista da prefeitura → radares publicados em notícias (cruzamentos/vias)
     ⌖  Nominatim ...... a "lista telefônica" → endereço/lugar → coordenada
     ➤  OSRM ........... o "copiloto" → rota e manobras
     🔊 TTS nativo ...... a "voz"
   Tudo grátis e sem chave de API.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

/* ───────────── CONFIGURAÇÃO ───────────── */
const CFG = {
  center: [-22.858, -47.220],               // centro aproximado de Hortolândia [lat, lon]
  bbox: [-22.93, -47.31, -22.79, -47.12],   // [sul, oeste, norte, leste] (Hortolândia + rodovias vizinhas)
  alertDist: 400,          // começa a avisar o radar a 400 m
  aheadAngle: 50,          // radar só conta se estiver até ±50° da direção em que ando
  offRouteDist: 60,        // >60 m longe da linha da rota = saiu da rota
  zoneDist: 18,            // a ≤18 m do eixo de uma via = "estou nessa via"
  cityCacheDays: 14,
  overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
  nominatim: 'https://nominatim.openstreetmap.org/search',
  osrm: 'https://router.project-osrm.org/route/v1/driving/',
  tiles: { style: 'https://tiles.openfreemap.org/styles/liberty',
           source: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
           glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' },
};

/* ═════════════ RADARES DA PREFEITURA (publicados em notícias) ═════════════
   As notícias não dão coordenadas, só "Rua X com Rua Y" ou "perto de tal lugar".
   O app descobre a posição sozinho:
     • cross → acha o ponto onde as duas ruas se cruzam no desenho do OSM
     • near  → acha o lugar (Nominatim) e "gruda" no ponto mais próximo da rua
     • só street → não se sabe o ponto exato: avisa ao ENTRAR na via ("zona")
   Os padrões usam "." no lugar de letras acentuadas (funciona com/sem acento). */
const SEED = [
  { id: 'p1', label: 'Av. Olívio Franceschini × R. João Mendes', street: 'Ol.vio Franceschini', cross: 'Jo.o Mendes', limit: 60, src: 'Prefeitura, out/2025' },
  { id: 'p2', label: 'R. Flamboyant × Av. Sabina B. de Camargo', street: 'Flamboyant', cross: 'Sabina', limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, out/2025' },
  { id: 'p3', label: 'Av. Sabina B. de Camargo × Estr. Prataviera', street: 'Sabina', cross: 'Prataviera', limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, mar/2025' },
  { id: 'p4', label: 'R. José Pereira de Lira (acesso P.I. Panaíno)', street: 'Pereira de Lira', cross: 'Pana.no', limit: 40, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p5', label: 'Corredor Metropolitano (frente ao Paço)', street: 'Corredor|Bil.o Soares', near: 'Prefeitura Municipal de Hortolândia', limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p6', label: 'Av. da Emancipação (perto da Wickbold)', street: 'Emancipa..o', near: 'Wickbold', limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, ago/2025' },
  { id: 'p7', label: 'Av. da Emancipação (perto da Magneti Marelli)', street: 'Emancipa..o', near: 'Magneti Marelli', limit: 60, dir: 'bairro → Centro', src: 'Prefeitura, ago/2025' },
  { id: 'p8', label: 'Av. da Emancipação (Hospital Mário Covas)', street: 'Emancipa..o', near: 'Hospital Municipal Mário Covas', limit: 50, src: 'lista de 2019' },
  { id: 'p9', label: 'Estr. Carlos R. Prataviera (frente ao cemitério)', street: 'Prataviera', near: 'Cemitério Hortolândia', limit: 50, src: 'lista de 2019' },
  { id: 'z1', label: 'R. Nelson Pereira Bueno', street: 'Nelson Pereira Bueno', limit: 50, src: 'lista de 2019' },
  { id: 'z2', label: 'Av. Santana (Jd. Amanda)', street: '^Avenida Santana$', limit: 50, src: 'lista de 2019' },
  { id: 'z3', label: 'Av. São Francisco de Assis', street: 'S.o Francisco de Assis', limit: 50, src: 'lista de 2019' },
  { id: 'z4', label: 'Av. Thereza Ana Cecon Breda', street: 'Cecon Breda', limit: 50, src: 'lista de 2019' },
  { id: 'z5', label: 'Av. Brasil (Jd. Amanda)', street: '^Avenida Brasil$', limit: 50, src: 'lista de 2019' },
  { id: 'z6', label: 'R. Augusto dos Anjos', street: 'Augusto dos Anjos', limit: 50, src: 'lista de 2019' },
  { id: 'z7', label: 'R. Luiz Camilo de Camargo', street: 'Lu.z Camilo de Camargo', limit: 50, src: 'lista de 2019' },
  { id: 'z8', label: 'R. Otaviano de Figueiredo Breda', street: 'Otaviano de Figueiredo Breda', limit: 50, src: 'lista de 2019' },
  { id: 'z9', label: 'Superviário', street: 'Supervi.rio', limit: 50, src: 'Prefeitura, jun/2026' },
];

/* ═════════════ GEOMETRIA (a matemática por trás) ═════════════ */
const R = 6371000;                         // raio médio da Terra em metros
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

/* Haversine: distância "em linha reta" sobre a esfera.
   Medimos o ÂNGULO central entre os 2 pontos e multiplicamos pelo raio (arco = R·θ).
     h = sen²(Δφ/2) + cos φ1 · cos φ2 · sen²(Δλ/2)   (φ = latitude, λ = longitude)
     θ = 2·asin(√h)      →  d = R·θ                                       */
function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Rumo (bearing) de A para B, graus a partir do Norte, sentido horário (bússola).
     y = sen Δλ · cos φ2 ;  x = cos φ1 · sen φ2 − sen φ1 · cos φ2 · cos Δλ ;  θ = atan2(y, x) */
function bearing(a, b) {
  const φ1 = toRad(a[0]), φ2 = toRad(b[0]), Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
/* Menor diferença entre dois ângulos (350° e 10° diferem 20°, não 340°) */
function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

/* Projeção equiretangular local: numa cidade a Terra é quase plana.
     x = Δλ · cos(φ_ref) · R   (longitude "encolhe" longe do Equador → cos φ)
     y = Δφ · R                                                            */
function project(p, ref) {
  return [toRad(p[1] - ref[1]) * Math.cos(toRad(ref[0])) * R, toRad(p[0] - ref[0]) * R];
}
/* Distância de P ao segmento AB.  t = (AP·AB)/|AB|², preso em [0,1]; ponto mais próximo C = A + t·AB */
function distToSegment(p, a, b) {
  const A = project(a, p), B = project(b, p);
  const ABx = B[0] - A[0], ABy = B[1] - A[1];
  const len2 = ABx * ABx + ABy * ABy;
  let t = len2 ? -(A[0] * ABx + A[1] * ABy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(A[0] + t * ABx, A[1] + t * ABy), t };
}
/* Ponto mais próximo de P numa lista de linhas (cada linha = [[lat,lon],...]) */
function nearestOnLines(p, lines) {
  let best = { d: Infinity, pt: null };
  for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) {
    const s = distToSegment(p, ln[i], ln[i + 1]);
    if (s.d < best.d) best = { d: s.d, pt: [ln[i][0] + s.t * (ln[i + 1][0] - ln[i][0]), ln[i][1] + s.t * (ln[i + 1][1] - ln[i][1])] };
  }
  return best;
}
const ll = p => [p[1], p[0]];              // [lat,lon] → [lon,lat] (o MapLibre usa lon primeiro)

/* ═════════════ ESTADO ═════════════ */
const S = {
  pos: null, prevPos: null, speed: 0, heading: null, acc: null, lastFixT: 0,
  follow: true, muted: false, mode3d: load('nc_3d', true),
  city: { radars: [], zones: [], signals: [], missing: [] },
  reports: load('nc_reports', []),
  overrides: load('nc_overrides', {}),       // posições de radar que você corrigiu
  route: null, navigating: false, along: 0, segIdx: 0, offCount: 0, lastReroute: 0,
  trip: null, dest: null, alerted: {}, activeAlert: null, zoneState: {}, pickFor: null,
};
function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ═════════════ VOZ / SOM / VIBRAÇÃO ═════════════ */
let audioCtx = null;
function beep(freq = 880, ms = 120, times = 2) {
  if (S.muted || !audioCtx) return;
  for (let i = 0; i < times; i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    const t0 = audioCtx.currentTime + i * (ms / 1000) * 1.8;
    g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + ms / 1000);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + ms / 1000);
  }
}
function speak(text) {
  if (S.muted) return;
  if (window.Android && Android.speak) { Android.speak(text); return; }
  if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
}
function vibrate(ms) { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); }
let toastT;
function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ═════════════ MAPA 3D ═════════════
   O mapa chega em VETOR (linhas e polígonos crus) e NÓS escrevemos o estilo
   inteiro, camada por camada, imitando o mapa do jogo:
     quarteirões vermelho-escuros · prédios 3D carmim (mais altos = mais claros)
     ruas ciano com "brilho" (uma linha borrada e larga por baixo da linha fina)
     nomes de bairros em MAIÚSCULAS espaçadas · divisa da cidade em verde neon */
const PAL = {
  'theme-arasaka': {   // "Night City": igual às suas fotos do jogo
    bg: '#0a1622', land: '#3a0911', landHi: '#560c19', bldgLo: '#5e0d1a', bldgHi: '#d4243d',
    park: '#0a2129', water: '#061a2f', road: '#2fc6ff', roadMid: '#1a95c9', roadMinor: '#12607f',
    glow: '#00a8ff', label: '#7fe3f2', roadLabel: '#a8e6ff', border: '#39ff88', rail: '#3a4a5a' },
  'theme-netrunner': { // variação: ruas magenta, prédios ciano
    bg: '#05080e', land: '#0a1a24', landHi: '#0e2733', bldgLo: '#0f2c3a', bldgHi: '#18c4d8',
    park: '#06180f', water: '#040f1c', road: '#ff2a6d', roadMid: '#c41f57', roadMinor: '#5c1531',
    glow: '#ff2a6d', label: '#ffd1e0', roadLabel: '#ffa3c2', border: '#fcee0a', rail: '#3a2a3a' },
};
const themeKey = () => document.body.classList.contains('theme-netrunner') ? 'theme-netrunner' : 'theme-arasaka';

function buildStyle(P, src, glyphs) {
  const cls = ['get', 'class'];
  // largura por zoom: exponencial (cada nível de zoom dobra a escala do mapa → ruas crescem ~1,6×)
  const W = (s) => ['interpolate', ['exponential', 1.6], ['zoom'],
    12, ['match', cls, 'motorway', 2.2 * s, 'trunk', 2 * s, 'primary', 1.6 * s, 'secondary', 1.3 * s, 'tertiary', 1 * s, 'minor', .6 * s, .3 * s],
    18, ['match', cls, 'motorway', 24 * s, 'trunk', 22 * s, 'primary', 17 * s, 'secondary', 15 * s, 'tertiary', 12 * s, 'minor', 9 * s, 4 * s]];
  const roads = ['match', cls, ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track'], true, false];
  const roadColor = ['match', cls, ['motorway', 'trunk', 'primary'], P.road, ['secondary', 'tertiary'], P.roadMid, P.roadMinor];
  const height = ['coalesce', ['get', 'render_height'], 6];   // prédio sem altura cadastrada = 6 m (2 andares)
  const R_ = ['Noto Sans Regular'], B_ = ['Noto Sans Bold'];
  const T = (id, type, layer, extra) => Object.assign({ id, type, source: 'omt', 'source-layer': layer }, extra);
  return {
    version: 8, glyphs, sources: { omt: src },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': P.bg } },
      T('landuse', 'fill', 'landuse', { filter: ['match', cls, ['residential', 'commercial', 'retail', 'industrial', 'neighbourhood', 'suburb', 'quarter', 'garages', 'railway'], true, false],
        paint: { 'fill-color': ['match', cls, ['commercial', 'retail', 'industrial'], P.landHi, P.land], 'fill-opacity': 0.9 } }),
      T('landcover', 'fill', 'landcover', { filter: ['match', cls, ['grass', 'wood', 'farmland', 'wetland', 'scrub'], true, false], paint: { 'fill-color': P.park, 'fill-opacity': 0.7 } }),
      T('park', 'fill', 'park', { paint: { 'fill-color': P.park } }),
      T('water', 'fill', 'water', { paint: { 'fill-color': P.water } }),
      T('waterway', 'line', 'waterway', { paint: { 'line-color': P.water, 'line-width': 2 } }),
      T('boundary', 'line', 'boundary', { filter: ['<=', ['to-number', ['get', 'admin_level']], 8],
        paint: { 'line-color': P.border, 'line-width': 2, 'line-opacity': 0.8 } }),
      T('rail', 'line', 'transportation', { filter: ['match', cls, ['rail', 'transit'], true, false],
        paint: { 'line-color': P.rail, 'line-width': 2, 'line-dasharray': [3, 2] } }),
      T('road-glow', 'line', 'transportation', { filter: roads, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': P.glow, 'line-width': W(2.4), 'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 16], 'line-opacity': 0.3 } }),
      T('road-case', 'line', 'transportation', { filter: roads, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#02060c', 'line-width': W(1.3) } }),
      T('road', 'line', 'transportation', { filter: roads, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': roadColor, 'line-width': W(1) } }),
      T('bldg-flat', 'fill', 'building', { maxzoom: 14.5, paint: { 'fill-color': P.bldgLo } }),
      // Prédios 3D: cor interpolada pela altura (0 m = carmim escuro → 40 m = vermelho vivo)
      T('bldg-3d', 'fill-extrusion', 'building', { minzoom: 14,
        paint: { 'fill-extrusion-color': ['interpolate', ['linear'], height, 0, P.bldgLo, 40, P.bldgHi],
                 'fill-extrusion-height': height,
                 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                 'fill-extrusion-opacity': 0.92 } }),
      T('road-label', 'symbol', 'transportation_name', { minzoom: 14.5,
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']], 'text-font': R_, 'text-size': 11, 'text-letter-spacing': 0.06 },
        paint: { 'text-color': P.roadLabel, 'text-halo-color': '#02060c', 'text-halo-width': 1.5 } }),
      T('place-label', 'symbol', 'place', { filter: ['match', cls, ['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter', 'hamlet'], true, false],
        layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': B_, 'text-size': ['match', cls, ['city', 'town'], 17, 'suburb', 13, 12],
                  'text-letter-spacing': 0.18, 'text-max-width': 8 },
        paint: { 'text-color': P.label, 'text-halo-color': '#02060c', 'text-halo-width': 2 } }),
    ],
  };
}

let map = null, mapReady = false, player = null;
const markers = { radar: [], report: [], dest: null };

async function initMap() {
  let src = CFG.tiles.source, glyphs = CFG.tiles.glyphs;
  try {   // pega do estilo oficial os endereços dos dados/fontes (se mudarem, o app acompanha)
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const base = await (await fetch(CFG.tiles.style, { signal: ctl.signal })).json();
    const k = Object.keys(base.sources).find(s => base.sources[s].type === 'vector');
    if (k) src = base.sources[k];
    if (base.glyphs) glyphs = base.glyphs;
  } catch (e) { console.warn('estilo base indisponível, usando padrão', e); }

  map = new maplibregl.Map({
    container: 'map', style: buildStyle(PAL[themeKey()], src, glyphs),
    center: ll(CFG.center), zoom: 15, pitch: S.mode3d ? 55 : 0, maxPitch: 70,
    attributionControl: { compact: true, customAttribution: 'OSRM · Nominatim' },
  });
  map.on('load', () => {
    mapReady = true;
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource('zones', { type: 'geojson', data: empty });
    map.addSource('signals', { type: 'geojson', data: empty });
    map.addSource('route', { type: 'geojson', data: empty });
    // vias com radar sem ponto exato: tracejado magenta
    map.addLayer({ id: 'zones', type: 'line', source: 'zones', paint: { 'line-color': '#ff2a6d', 'line-width': 5, 'line-opacity': 0.55, 'line-dasharray': [2, 1.5] } }, 'road-label');
    map.addLayer({ id: 'signals', type: 'circle', source: 'signals', minzoom: 15,
      paint: { 'circle-radius': 3.5, 'circle-color': '#fcee0a', 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } }, 'road-label');
    // rota: creme com brilho laranja, igual à linha de missão do jogo
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ff9a3c', 'line-width': 18, 'line-blur': 10, 'line-opacity': 0.55 } }, 'road-label');
    map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fff1d6', 'line-width': 6 } }, 'road-label');
    renderCity(); renderReports();
    if (S.pos) onLocation(S.pos[0], S.pos[1], null, null, S.acc);
  });
  map.on('error', e => console.warn('map', e?.error?.message || e));
  // gesto do usuário (arrastar/girar/inclinar) solta a câmera
  ['dragstart', 'rotatestart', 'pitchstart'].forEach(ev => map.on(ev, e => { if (e.originalEvent) setFollow(false); }));
  map.on('contextmenu', e => openReportMenu([e.lngLat.lat, e.lngLat.lng]));
  map.on('click', e => {
    if (!S.pickFor) return;
    S.overrides[S.pickFor] = [e.lngLat.lat, e.lngLat.lng]; save('nc_overrides', S.overrides);
    S.pickFor = null; toast('POSIÇÃO DO RADAR CORRIGIDA'); renderCity();
  });
  setupLongPress();
}

/* Câmera estilo GPS de carro: inclinada 60°, girando junto com você (a frente fica "pra cima")
   e com você um pouco abaixo do centro, para enxergar mais o que vem pela frente. */
function followCamera() {
  if (!S.follow || !mapReady || !S.pos) return;
  const o = { center: ll(S.pos), duration: 900, essential: true };
  if (S.mode3d) {
    o.pitch = 60; o.zoom = Math.max(map.getZoom(), 16.6);
    if (S.heading != null && S.speed > 4) o.bearing = S.heading;
    o.offset = [0, map.getContainer().clientHeight * 0.2];
  } else { o.pitch = 0; o.bearing = 0; }
  map.easeTo(o);
}

/* ═════════════ BOOT ═════════════ */
(function boot() {
  const lines = ['> carregando kiroshi optics...', '> sincronizando satélites GPS...', '> renderizando Night City 3D...', '> radar.daemon ONLINE', '> pronto, choom.'];
  let i = 0; const log = $('bootlog');
  const tick = setInterval(() => { if (i >= lines.length) return clearInterval(tick); log.textContent += lines[i++] + '\n'; }, 280);
  $('jackin').onclick = () => {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    beep(660, 80, 1);
    $('boot').classList.add('hidden');
    if (map) map.resize();
    startLocation();
    loadCityData(false);
  };
})();

/* ═════════════ LOCALIZAÇÃO ═════════════ */
function startLocation() {
  if (window.Android) return;               // no APK o Java empurra a posição via onNativeLocation
  if (!navigator.geolocation) return setGps('SEM GPS', true);
  navigator.geolocation.watchPosition(
    p => onLocation(p.coords.latitude, p.coords.longitude, p.coords.speed, p.coords.heading, p.coords.accuracy),
    () => setGps('NEGADO', true), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}
window.onNativeLocation = onLocation;
window.onGpsDenied = () => setGps('NEGADO', true);
function setGps(txt, bad) { const g = $('gpsStatus'); g.textContent = 'GPS: ' + txt; g.classList.toggle('bad', !!bad); }

function onLocation(lat, lon, speedMs, head, acc) {
  const p = [lat, lon];
  S.acc = acc;
  setGps(acc ? `±${Math.round(acc)}m` : 'OK', acc > 50);
  // velocidade: GPS dá m/s → km/h = m/s × 3,6.  Sem ela: v = Δd/Δt
  if (speedMs != null && !isNaN(speedMs)) S.speed = Math.max(0, speedMs * 3.6);
  else if (S.pos && S.lastFixT) { const dt = (Date.now() - S.lastFixT) / 1000; if (dt > 0.5) S.speed = haversine(S.pos, p) / dt * 3.6; }
  // rumo: o do GPS (se andando) ou entre a "âncora" (último ponto a >6 m) e o atual
  if (!S.prevPos) S.prevPos = p;
  const moved = haversine(S.prevPos, p);
  if (head != null && !isNaN(head) && S.speed > 3) S.heading = head;
  else if (moved > 6) S.heading = bearing(S.prevPos, p);
  if (moved > 6) S.prevPos = p;
  const first = !S.pos;
  S.pos = p; S.lastFixT = Date.now();

  if (mapReady) {
    if (!player) player = new maplibregl.Marker({ element: playerEl(), rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(ll(p)).addTo(map);
    player.setLngLat(ll(p));
    if (S.heading != null) player.setRotation(S.heading);
    if (first) map.jumpTo({ center: ll(p), zoom: 17 });
    followCamera();
  }
  updateSpeedo();
  checkRadars();
  if (S.route) updateNavigation();
}
function playerEl() {
  const d = document.createElement('div'); d.className = 'player';
  d.innerHTML = `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="rgba(57,255,136,.14)" stroke="#39ff88" stroke-width="2"/>
    <path d="M24 9 L34 34 L24 28 L14 34 Z" fill="#39ff88" stroke="#eafff2" stroke-width="1.5"/></svg>`;
  return d;
}

/* ═════════════ VELOCÍMETRO ═════════════
   Arco de 270° numa circunferência de raio 50: comprimento total 2π·50 ≈ 314,2 → 270° ≈ 235,6.
   Preenchemos proporcional à velocidade (escala 0–160 km/h). */
function updateSpeedo(limit) {
  const v = Math.round(S.speed);
  $('spVal').textContent = v;
  $('spArc').style.strokeDasharray = `${(235.6 * Math.min(v / 160, 1)).toFixed(1)} 314.2`;
  const lim = limit ?? S.activeAlert?.limit;
  $('speedo').classList.toggle('over', !!lim && v > lim);
  $('spLimit').classList.toggle('hidden', !lim);
  if (lim) $('spLimit').textContent = lim;
}

/* ═════════════ DADOS DA CIDADE: ruas com radar, semáforos, câmeras do OSM ═════════════ */
async function overpass(q) {
  for (const url of CFG.overpass) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.ok) return (await r.json()).elements;
    } catch (e) { console.warn('overpass', url, e); }
  }
  throw new Error('overpass indisponível');
}

async function loadCityData(force) {
  const cache = load('nc_city', null);
  if (!force && cache && cache.v === 2 && Date.now() - cache.t < CFG.cityCacheDays * 864e5) { S.city = cache.data; renderCity(); return; }
  toast('MAPEANDO RADARES E SEMÁFOROS DE HORTOLÂNDIA...', 6000);
  const [s, w, n, e] = CFG.bbox, bb = `${s},${w},${n},${e}`;
  const pats = [...new Set(SEED.flatMap(x => [x.street, x.cross].filter(Boolean)))];
  const q = `[out:json][timeout:90];
    area["name"="Hortolândia"]["admin_level"="8"]->.h;
    way(area.h)["highway"]["name"~"${pats.map(p => `(${p})`).join('|')}",i];
    out body geom;
    node(area.h)["highway"="traffic_signals"]; out body;
    (node["highway"="speed_camera"](${bb}); node["enforcement"="maxspeed"](${bb}); relation["type"="enforcement"](${bb}););
    out body; >; out skel qt;`;
  let els;
  try { els = await overpass(q); }
  catch { if (cache) { S.city = cache.data; renderCity(); } toast('SEM CONEXÃO COM O OPENSTREETMAP — tente ⟳ depois'); return; }

  const ways = els.filter(x => x.type === 'way' && x.geometry && x.tags?.name)
    .map(x => ({ name: x.tags.name, nodes: x.nodes, geom: x.geometry.map(g => [g.lat, g.lon]) }));
  const signals = els.filter(x => x.type === 'node' && x.tags?.highway === 'traffic_signals').map(x => [x.lat, x.lon]);
  const radars = parseCameras(els), zones = [], missing = [];
  const waysOf = pat => { const re = new RegExp(pat, 'i'); return ways.filter(w => re.test(w.name)); };

  for (const sd of SEED) {
    const A = waysOf(sd.street);
    if (!A.length) { missing.push(sd.label); continue; }
    let pt = null, how = '';
    if (sd.cross) { pt = intersect(A, waysOf(sd.cross)); how = 'cruzamento'; }
    else if (sd.near) {
      try {
        const url = `${CFG.nominatim}?format=jsonv2&limit=1&countrycodes=br&viewbox=${w},${n},${e},${s}&bounded=1&q=${encodeURIComponent(sd.near + ', Hortolândia')}`;
        const res = await (await fetch(url)).json();
        await sleep(1100);                                    // regra do Nominatim: no máx. 1 busca por segundo
        if (res[0]) { const nb = nearestOnLines([+res[0].lat, +res[0].lon], A.map(a => a.geom)); if (nb.d < 700) { pt = nb.pt; how = 'perto de ' + sd.near; } }
      } catch {}
    }
    if (pt) radars.push({ id: sd.id, lat: pt[0], lon: pt[1], limit: sd.limit, label: sd.label, dir: sd.dir, src: sd.src, how, origin: 'pref' });
    else zones.push({ id: sd.id, label: sd.label, limit: sd.limit, src: sd.src, lines: A.map(a => a.geom) });
  }
  S.city = { radars, zones, signals, missing };
  save('nc_city', { v: 2, t: Date.now(), data: S.city });
  renderCity();
  toast(`${radars.length} RADARES · ${zones.length} VIAS COM RADAR · ${signals.length} SEMÁFOROS`, 4500);
  if (S.route) markRouteSignals();
}

/* Cruzamento de duas ruas: no OSM, ruas que se cruzam compartilham um "nó" (mesmo id).
   Se não compartilham (viaduto, passagem inferior), pega o par de pontos mais próximo (< 80 m). */
function intersect(A, B) {
  if (!B.length) return null;
  for (const a of A) {
    const ids = new Map(a.nodes.map((id, i) => [id, a.geom[i]]));
    for (const b of B) for (const id of b.nodes) if (ids.has(id)) return ids.get(id);
  }
  let best = { d: Infinity, pt: null };
  for (const a of A) for (const p of a.geom) { const nb = nearestOnLines(p, B.map(b => b.geom)); if (nb.d < best.d) best = { d: nb.d, pt: p }; }
  return best.d < 80 ? best.pt : null;
}

function parseCameras(els) {
  const nodes = {}, out = new Map();
  for (const e of els) if (e.type === 'node') nodes[e.id] = e;
  const lim = t => { const m = String(t?.maxspeed || '').match(/\d+/); return m ? +m[0] : null; };
  for (const e of els) {
    if (e.type === 'node' && (e.tags?.highway === 'speed_camera' || e.tags?.enforcement))
      out.set(e.id, { id: 'osm' + e.id, lat: e.lat, lon: e.lon, limit: lim(e.tags), dir: null, osmDir: e.tags.direction ?? null, label: 'Câmera cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
    if (e.type === 'relation' && e.members) {
      const dev = e.members.find(m => m.role === 'device' && m.type === 'node') || e.members.find(m => m.type === 'node');
      const nd = dev && nodes[dev.ref];
      if (nd) out.set(nd.id, { id: 'osm' + nd.id, lat: nd.lat, lon: nd.lon, limit: lim(e.tags) ?? out.get(nd.id)?.limit ?? null, dir: null, osmDir: null, label: 'Câmera cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
    }
  }
  return [...out.values()];
}

/* posição efetiva (respeita sua correção manual) */
const posOf = r => S.overrides[r.id] || [r.lat, r.lon];

function mkEl(cls, html) { const d = document.createElement('div'); d.innerHTML = `<div class="mk ${cls}">${html}</div>`; return d.firstChild; }
function addMarker(p, el, html) {
  const m = new maplibregl.Marker({ element: el }).setLngLat(ll(p));
  if (html) m.setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(html));
  return m.addTo(map);
}

function renderCity() {
  const c = S.city, userR = S.reports.filter(x => x.type === 'radar').length;
  $('radarCount').textContent = `RADARES: ${c.radars.length + c.zones.length + userR}`;
  if (!mapReady) return;
  markers.radar.forEach(m => m.remove()); markers.radar = [];
  for (const r of c.radars) {
    const fixed = S.overrides[r.id] ? ' · posição corrigida por você' : (r.origin === 'pref' ? ` · posição calculada (${r.how})` : '');
    markers.radar.push(addMarker(posOf(r), mkEl('radar' + (r.origin === 'pref' ? ' pref' : ''), r.limit ?? '◉'),
      `<b>RADAR ${r.limit ? r.limit + ' KM/H' : ''}</b><br>${r.label}${r.dir ? '<br>Sentido ' + r.dir : ''}
       <br><small>Fonte: ${r.src}${fixed}</small><br><button class="cp-btn" onclick="pickRadar('${r.id}')">AJUSTAR POSIÇÃO</button>`));
  }
  map.getSource('zones')?.setData({ type: 'FeatureCollection', features: c.zones.flatMap(z => z.lines.map(l => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.map(ll) } }))) });
  map.getSource('signals')?.setData({ type: 'FeatureCollection', features: c.signals.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ll(p) } })) });
}
window.pickRadar = id => { S.pickFor = id; document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); toast('TOQUE NO MAPA ONDE FICA ESSE RADAR', 5000); };

/* ═════════════ radar.daemon: roda a cada posição nova ═════════════ */
const LABEL = { radar: 'RADAR', police: 'POLÍCIA', accident: 'ACIDENTE', hazard: 'PERIGO' };
function checkRadars() {
  if (!S.pos) return;
  let best = null;
  const pts = [...S.city.radars.map(r => ({ ...r, type: 'radar' })), ...S.reports];
  for (const r of pts) {
    const p = posOf(r), d = haversine(S.pos, p);
    if (d > CFG.alertDist + 150) { delete S.alerted[r.id]; continue; }
    if (d > CFG.alertDist) continue;
    // está À FRENTE? compara o rumo até o radar com o rumo em que ando (±50°)
    if (S.heading != null && d > 40 && angleDiff(bearing(S.pos, p), S.heading) > CFG.aheadAngle) continue;
    if (r.osmDir != null && !isNaN(+r.osmDir) && S.heading != null && angleDiff(+r.osmDir, S.heading) > 60) continue;
    if (!best || d < best.d) best = { ...r, d };
  }
  if (!best && S.speed > 8) best = checkZones();
  showAlert(best);
}
/* "Zona": via com radar de ponto desconhecido. Se estou a ≤18 m do eixo da via, estou nela. */
function checkZones() {
  for (const z of S.city.zones) {
    const nb = nearestOnLines(S.pos, z.lines);
    if (nb.d <= CFG.zoneDist + (S.acc || 0) * 0.3) { S.zoneState[z.id] = Date.now(); return { ...z, type: 'zone', d: 0 }; }
  }
  return null;
}

function showAlert(a) {
  S.activeAlert = a && (a.type === 'radar' || a.type === 'zone') ? a : null;
  if (!a) { $('radarAlert').classList.add('hidden'); $('alertFrame').classList.remove('on'); updateSpeedo(); return; }
  const over = a.limit && S.speed > a.limit;
  $('radarAlert').classList.remove('hidden');
  $('raTitle').textContent = a.type === 'zone' ? 'VIA COM RADAR' : `${LABEL[a.type]} · ${Math.round(a.d / 10) * 10} m`;
  $('raSub').textContent = a.limit ? (over ? `⚠ REDUZA! LIMITE ${a.limit}` : `LIMITE ${a.limit} KM/H`) : 'ATENÇÃO À FRENTE';
  $('alertFrame').classList.toggle('on', !!over);
  updateSpeedo(a.limit);
  const st = S.alerted[a.id] || (S.alerted[a.id] = {});
  if (!st.first) {
    st.first = true; beep(a.type === 'hazard' || a.type === 'accident' ? 700 : 1200, 120, 3); vibrate(400);
    speak(a.type === 'zone' ? `Via com radar, limite ${a.limit}` : `${LABEL[a.type].toLowerCase()} em ${Math.round(a.d / 50) * 50} metros${a.limit ? ', limite ' + a.limit : ''}`);
  } else if (over && !st.over && (a.type === 'zone' || a.d < 200)) {
    st.over = true; beep(1500, 90, 5); vibrate(800); speak(`Reduza, limite ${a.limit}`);
  }
  if (a.type === 'zone') setTimeout(() => { if (Date.now() - (S.zoneState[a.id] || 0) > 30000) delete S.alerted[a.id]; }, 31000);
}

/* ═════════════ REPORTES (toque longo no mapa) ═════════════ */
let pendingP = null;
function openReportMenu(p) { pendingP = p; vibrate(40); $('reportMenu').classList.remove('hidden'); }
function setupLongPress() {
  const el = map.getCanvasContainer(); let timer = null, start = null;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { clearTimeout(timer); return; }
    const t = e.touches[0], r = el.getBoundingClientRect(); start = [t.clientX, t.clientY];
    timer = setTimeout(() => { const q = map.unproject([t.clientX - r.left, t.clientY - r.top]); openReportMenu([q.lat, q.lng]); }, 650);
  }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; if (start && Math.hypot(t.clientX - start[0], t.clientY - start[1]) > 10) clearTimeout(timer); }, { passive: true });
  el.addEventListener('touchend', () => clearTimeout(timer));
}
$('reportMenu').addEventListener('click', e => {
  const type = e.target.dataset?.type; if (!type) return;
  $('reportMenu').classList.add('hidden');
  if (type === 'close' || !pendingP) return;
  if (type === 'route') return routeTo(pendingP, 'Ponto no mapa');
  S.reports.push({ id: 'u' + Date.now(), type, lat: pendingP[0], lon: pendingP[1], limit: type === 'radar' ? +$('rmSpeed').value : null, t: Date.now() });
  save('nc_reports', S.reports); renderReports(); renderCity(); toast(`${LABEL[type]} MARCADO`);
});
const ICON_CH = { radar: '◉', police: '⛨', accident: '✸', hazard: '⚠' };
function renderReports() {
  if (!mapReady) return;
  markers.report.forEach(m => m.remove()); markers.report = [];
  for (const r of S.reports) {
    const el = r.type === 'radar' ? mkEl('radar user', r.limit ?? '◉') : mkEl(r.type, ICON_CH[r.type]);
    markers.report.push(addMarker([r.lat, r.lon], el, `<b>${LABEL[r.type]} (SEU)</b><br>${r.limit ? 'Limite ' + r.limit + ' km/h<br>' : ''}
      <small>há ${Math.round((Date.now() - r.t) / 3600e3)} h</small><br><button class="cp-btn red" onclick="delReport('${r.id}')">REMOVER</button>`));
  }
}
window.delReport = id => { S.reports = S.reports.filter(r => r.id !== id); save('nc_reports', S.reports); renderReports(); renderCity(); document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); };

/* ═════════════ BUSCA (Nominatim) ═════════════ */
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(search, 700); });
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qTimer); search(); } });
$('qClear').onclick = () => { $('q').value = ''; $('results').classList.add('hidden'); };
async function search() {
  const q = $('q').value.trim(); if (q.length < 3) return $('results').classList.add('hidden');
  const [s, w, n, e] = CFG.bbox;
  const url = `${CFG.nominatim}?format=jsonv2&limit=7&countrycodes=br&accept-language=pt-BR&viewbox=${w},${n},${e},${s}&bounded=0&q=${encodeURIComponent(q)}`;
  try {
    const list = await (await fetch(url)).json(), ref = S.pos || CFG.center;
    list.sort((a, b) => haversine(ref, [+a.lat, +a.lon]) - haversine(ref, [+b.lat, +b.lon]));
    const box = $('results'); box.innerHTML = list.length ? '' : '<div class="res"><small>Nada encontrado</small></div>';
    for (const it of list) {
      const [title, ...rest] = it.display_name.split(',');
      const div = document.createElement('div'); div.className = 'res';
      div.innerHTML = `<b>${title}</b><small>${rest.slice(0, 3).join(',')} · ${(haversine(ref, [+it.lat, +it.lon]) / 1000).toFixed(1)} km</small>`;
      div.onclick = () => { box.classList.add('hidden'); $('q').blur(); routeTo([+it.lat, +it.lon], title); };
      box.appendChild(div);
    }
    box.classList.remove('hidden');
  } catch { toast('ERRO NA BUSCA — sem internet?'); }
}

/* ═════════════ ROTA (OSRM) ═════════════ */
async function routeTo(dest, name) {
  if (!S.pos) return toast('AGUARDANDO SINAL DE GPS...');
  S.dest = { p: dest, name };
  try {
    const url = `${CFG.osrm}${S.pos[1]},${S.pos[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`;
    const j = await (await fetch(url)).json();
    if (j.code !== 'Ok' || !j.routes.length) throw new Error(j.code);
    buildRoute(j.routes[0]);
    if (!S.navigating) {
      const b = new maplibregl.LngLatBounds(); S.route.coords.forEach(c => b.extend(ll(c)));
      setFollow(false); map.fitBounds(b, { padding: { top: 190, bottom: 130, left: 50, right: 70 }, pitch: 0, bearing: 0, duration: 800 });
    } else setFollow(true);
  } catch (e) { toast('NÃO FOI POSSÍVEL CALCULAR A ROTA'); console.warn(e); }
}

function buildRoute(rt) {
  const coords = rt.geometry.coordinates.map(c => [c[1], c[0]]);
  const cum = [0];       // cum[i] = distância acumulada do início até o vértice i
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const steps = rt.legs.flatMap(l => l.steps);
  let k = 0;
  const stepAlong = steps.map(st => {   // cada manobra → "a quantos metros do início ela fica"
    const loc = [st.maneuver.location[1], st.maneuver.location[0]];
    let bi = k, bd = Infinity;
    for (let i = k; i < coords.length; i++) { const d = haversine(loc, coords[i]); if (d < bd) { bd = d; bi = i; } if (d > bd + 300) break; }
    k = bi; return cum[bi];
  });
  S.route = { coords, cum, total: cum[cum.length - 1], duration: rt.duration, steps, stepAlong, said: {}, signalAlong: [] };
  S.segIdx = 0; S.along = 0; S.offCount = 0;
  if (S.trip) S.trip.lastAlong = 0;
  markRouteSignals();
  map.getSource('route')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.map(ll) } });
  markers.dest?.remove();
  markers.dest = addMarker(S.dest.p, mkEl('dest', '⬢'), `<b>DESTINO</b><br>${S.dest.name}`);
  $('tripBar').classList.remove('hidden');
  $('bGo').classList.toggle('hidden', S.navigating);
  updateTrip();
  updateNavigation();
}

/* Semáforos na rota: os que estão a ≤20 m da linha. Guardamos "em que metro da rota" cada um fica. */
function markRouteSignals() {
  const r = S.route; if (!r) return;
  const lats = r.coords.map(c => c[0]), lons = r.coords.map(c => c[1]), pad = 0.0004;   // ~40 m de folga
  const box = [Math.min(...lats) - pad, Math.min(...lons) - pad, Math.max(...lats) + pad, Math.max(...lons) + pad];
  r.signalAlong = [];
  for (const sg of S.city.signals) {
    if (sg[0] < box[0] || sg[0] > box[2] || sg[1] < box[1] || sg[1] > box[3]) continue;
    let best = { d: Infinity, a: 0 };
    for (let i = 0; i < r.coords.length - 1; i++) {
      const s = distToSegment(sg, r.coords[i], r.coords[i + 1]);
      if (s.d < best.d) best = { d: s.d, a: r.cum[i] + s.t * (r.cum[i + 1] - r.cum[i]) };
    }
    if (best.d <= 20) r.signalAlong.push(best.a);
  }
  r.signalAlong.sort((a, b) => a - b);
  updateTrip();
}

/* ═════════════ TEMPO DE CHEGADA "DE VERDADE" ═════════════
   O OSRM calcula como se as ruas estivessem livres e quase não conta semáforo (~2 s cada).
   Corrigimos em 3 camadas:

   1) Horário: multiplica o tempo rodando por um fator de trânsito
        pico (dias úteis 6h30–9h e 17h–19h30) ×1,35 · dia ×1,15 · noite/madrugada ×1,00

   2) Semáforos: VALOR ESPERADO da espera em cada um.
        Ciclo típico ~80 s; a via principal fica verde ~45% do tempo → P(vermelho) ≈ 0,55.
        Se pego vermelho, chego num instante aleatório dele → espero em média metade: 44 s ÷ 2 ≈ 22 s.
        Somando a perda de frear/arrancar (~5 s):  E[atraso] ≈ 0,55 × (22 + 5) ≈ 15 s por semáforo
        (no pico, filas maiores → ~22 s).  Descontamos os 2 s que o OSRM já tinha posto.

   3) Aprendizado ao vivo: depois que você começa a dirigir, medimos seu "pace" real
        (segundos por metro, já incluindo paradas). Misturamos com a previsão:
          t = (1 − w)·t_previsto + w·(distância_restante × pace_real),   w cresce até 0,5 com o trajeto. */
function trafficFactor(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60, wd = d.getDay() >= 1 && d.getDay() <= 5;
  if (wd && ((h >= 6.5 && h < 9) || (h >= 17 && h < 19.5))) return { f: 1.35, sig: 22, label: 'horário de pico' };
  if (h >= 6 && h < 21) return { f: 1.15, sig: 15, label: 'trânsito normal' };
  return { f: 1.0, sig: 12, label: 'trânsito livre' };
}
function estimate() {
  const r = S.route, rem = Math.max(0, r.total - S.along), tf = trafficFactor();
  const drive = r.duration * (rem / r.total) * tf.f;
  const sigAhead = r.signalAlong.filter(a => a > S.along + 10).length;
  const sigTime = sigAhead * (tf.sig - 2);
  let t = drive + sigTime, live = null;
  if (S.navigating && S.trip && S.trip.dist > 400) {
    const pace = (Date.now() - S.trip.t0) / 1000 / S.trip.dist;
    const w = Math.min(S.trip.dist / 4000, 0.5);
    live = { pace, w }; t = (1 - w) * t + w * rem * pace;
  }
  return { t, rem, drive, sigAhead, sigTime, tf, live };
}
function updateTrip() {
  if (!S.route) return;
  const E = estimate();
  $('tbEta').textContent = Math.max(1, Math.round(E.t / 60));
  $('tbDist').textContent = (E.rem / 1000).toFixed(1);
  $('tbSig').textContent = E.sigAhead;
  $('tbArr').textContent = new Date(Date.now() + E.t * 1000).toTimeString().slice(0, 5);
}
$('tbEtaCell').onclick = () => {   // toque no tempo → mostra a conta
  if (!S.route) return; const E = estimate();
  toast(`Rodando ${Math.round(E.drive / 60)} min (${E.tf.label}) + ${E.sigAhead} semáforos ≈ ${Math.round(E.sigTime / 60)} min` +
        (E.live ? ` · ajustado pelo seu ritmo (${Math.round(E.live.w * 100)}%)` : ''), 6000);
};

function updateNavigation() {
  const r = S.route; if (!r || !S.pos) return;
  // 1) onde estou NA rota? (segmento mais próximo numa janela à frente)
  let best = { d: Infinity, i: S.segIdx, t: 0 };
  const from = Math.max(0, S.segIdx - 5), to = Math.min(r.coords.length - 1, S.segIdx + 80);
  for (let i = from; i < to; i++) { const s = distToSegment(S.pos, r.coords[i], r.coords[i + 1]); if (s.d < best.d) best = { d: s.d, i, t: s.t }; }
  S.segIdx = best.i;
  S.along = r.cum[best.i] + best.t * (r.cum[best.i + 1] - r.cum[best.i]);
  if (S.navigating && S.trip) { S.trip.dist += Math.max(0, Math.min(S.along - S.trip.lastAlong, 200)); S.trip.lastAlong = S.along; }
  updateTrip();
  // 2) saiu da rota? (3 leituras seguidas longe → recalcula, no máx. a cada 15 s)
  if (best.d > CFG.offRouteDist + (S.acc || 0) * 0.5) S.offCount++; else S.offCount = 0;
  if (S.navigating && S.offCount >= 3 && Date.now() - S.lastReroute > 15000) {
    S.lastReroute = Date.now(); S.offCount = 0; speak('Recalculando rota'); toast('RECALCULANDO...'); routeTo(S.dest.p, S.dest.name); return;
  }
  // 3) chegou?
  if (haversine(S.pos, S.dest.p) < 30) { speak('Você chegou ao destino'); toast('DESTINO ALCANÇADO'); cancelRoute(); return; }
  // 4) próxima manobra
  let k = r.stepAlong.findIndex((a, i) => i > 0 && a > S.along + 5);
  if (k < 0) k = r.steps.length - 1;
  const step = r.steps[k], dist = r.stepAlong[k] - S.along;
  $('maneuver').classList.toggle('hidden', !S.navigating);
  $('mArrow').textContent = arrowFor(step);
  $('mDist').textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 10) * 10 + ' m';
  $('mInstr').textContent = instr(step);
  // 5) voz a ~500 m, ~150 m e "agora"
  if (!S.navigating) return;
  const said = r.said[k] || (r.said[k] = {});
  if (dist < 500 && dist > 250 && !said.far) { said.far = true; speak(`Em ${Math.round(dist / 100) * 100} metros, ${instr(step)}`); }
  else if (dist < 150 && dist > 50 && !said.near) { said.near = true; speak(`Em ${Math.round(dist / 10) * 10} metros, ${instr(step)}`); }
  else if (dist <= 35 && !said.now) { said.now = true; speak(instr(step)); beep(990, 60, 1); }
}

const DIR = { left: 'à esquerda', right: 'à direita', 'slight left': 'levemente à esquerda', 'slight right': 'levemente à direita',
  'sharp left': 'acentuadamente à esquerda', 'sharp right': 'acentuadamente à direita', straight: 'em frente', uturn: 'fazendo o retorno' };
function onName(n) { if (!n) return ''; return (/^(viaduto|acesso|anel|contorno|trevo|complexo|corredor)/i.test(n) ? ' no ' : ' na ') + n; }
function instr(st) {
  const m = st.maneuver, d = DIR[m.modifier] || '', nm = onName(st.name);
  switch (m.type) {
    case 'depart': return `Siga${nm}`;
    case 'arrive': return 'Chegada ao destino';
    case 'turn': case 'end of road': return m.modifier === 'uturn' ? `Faça o retorno${nm}` : `Vire ${d}${nm}`;
    case 'continue': case 'new name': return m.modifier === 'uturn' ? `Faça o retorno${nm}` : `Continue ${m.modifier && m.modifier !== 'straight' ? d : 'em frente'}${nm}`;
    case 'merge': return `Entre ${d}${nm}`;
    case 'on ramp': return `Pegue o acesso ${d}${nm}`;
    case 'off ramp': return `Pegue a saída ${d}${nm}`;
    case 'fork': return `Na bifurcação, mantenha-se ${d}${nm}`;
    case 'roundabout': case 'rotary': return `Na rotatória, pegue a ${m.exit || 1}ª saída${nm}`;
    case 'roundabout turn': return `Na rotatória, vire ${d}${nm}`;
    case 'exit roundabout': case 'exit rotary': return `Saia da rotatória${nm}`;
    default: return `Siga ${d}${nm}`.replace('  ', ' ');
  }
}
function arrowFor(st) {
  const t = st.maneuver.type, m = st.maneuver.modifier || '';
  if (t === 'arrive') return '⬢';
  if (t.includes('roundabout') || t.includes('rotary')) return '⟳';
  return { left: '↰', right: '↱', 'slight left': '↖', 'slight right': '↗', 'sharp left': '⮢', 'sharp right': '⮣', uturn: '⮌', straight: '↑' }[m] || '↑';
}
function cancelRoute() {
  S.route = null; S.navigating = false; S.dest = null; S.trip = null;
  map.getSource('route')?.setData({ type: 'FeatureCollection', features: [] });
  markers.dest?.remove(); markers.dest = null;
  $('tripBar').classList.add('hidden'); $('maneuver').classList.add('hidden');
  setFollow(true);
}

/* ═════════════ BOTÕES ═════════════ */
function setFollow(on) { S.follow = on; $('bFollow').classList.toggle('active', on); if (on) followCamera(); }
$('bFollow').onclick = () => setFollow(!S.follow);
$('bRadar').onclick = () => loadCityData(true);
$('b3d').onclick = () => {
  S.mode3d = !S.mode3d; save('nc_3d', S.mode3d); $('b3d').textContent = S.mode3d ? '3D' : '2D';
  if (!S.follow && mapReady) map.easeTo({ pitch: S.mode3d ? 60 : 0, bearing: S.mode3d ? map.getBearing() : 0 }); else followCamera();
};
$('bTheme').onclick = () => {
  document.body.classList.toggle('theme-arasaka'); document.body.classList.toggle('theme-netrunner');
  save('nc_theme', themeKey());
  if (!mapReady) return;   // repinta camada por camada (sem recarregar o mapa, a rota continua lá)
  for (const l of buildStyle(PAL[themeKey()], {}, '').layers) for (const [k, v] of Object.entries(l.paint || {})) map.setPaintProperty(l.id, k, v);
};
$('bMute').onclick = () => { S.muted = !S.muted; $('bMute').textContent = S.muted ? '🔇' : '🔊'; };
$('bGo').onclick = () => {
  S.navigating = true; S.trip = { t0: Date.now(), dist: 0, lastAlong: S.along };
  $('bGo').classList.add('hidden'); setFollow(true); speak('Rota iniciada. ' + instr(S.route.steps[0])); updateNavigation();
};
$('bCancel').onclick = cancelRoute;

{ const th = load('nc_theme', null); if (PAL[th]) { document.body.classList.remove('theme-arasaka', 'theme-netrunner'); document.body.classList.add(th); } }
$('b3d').textContent = S.mode3d ? '3D' : '2D';
initMap();
