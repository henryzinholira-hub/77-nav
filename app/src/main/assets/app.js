/* ════════════════════════════════════════════════════════════════════
   NIGHTCITY//NAV v3 — navegação com temas
   ────────────────────────────────────────────────────────────────────
     🛰  GPS ............ onde estou, velocidade, para onde aponto
     🗺  MapLibre 3D .... mapa vetorial pintado pelo tema (themes.js)
     🛣  Via atual ...... nome e limite da rua (OSM maxspeed ou padrão do CTB)
     ◉  Radares ........ prefeitura (notícias) + OSM + os que você marca
     ➤  OSRM ........... rota e manobras · ⌖ Nominatim: busca de endereço
     🔊 Avisos ......... voz + "piririn" com timbre do tema
   Tudo grátis e sem chave de API.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

const CFG = {
  center: [-22.858, -47.220],               // centro de Hortolândia [lat, lon]
  bbox: [-22.93, -47.31, -22.79, -47.12],   // [sul, oeste, norte, leste]
  aheadAngle: 50, offRouteDist: 60, zoneDist: 18, cityCacheDays: 14,
  overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
  nominatim: 'https://nominatim.openstreetmap.org/search',
  osrm: 'https://router.project-osrm.org/route/v1/driving/',
  tiles: { style: 'https://tiles.openfreemap.org/styles/liberty',
           source: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
           glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' },
};

/* ═════════════ CONFIGURAÇÕES DO USUÁRIO (salvas no celular) ═════════════ */
const DEFAULTS = {
  theme: 'nightcity', muted: false, voice: true, volume: 0.8, sound: 'piririn',
  speedWarn: true, warnEstimated: true, tolerance: 5, radarDist: 400, vibrate: true,
  mode3d: true, buildings3d: true, showSignals: true, showZones: true, navZoom: 16.8,
  autoReroute: true, smartEta: true,
};
const cfg = Object.assign({}, DEFAULTS, load('nc_cfg', {}));
if (!THEMES[cfg.theme]) cfg.theme = 'nightcity';
const saveCfg = () => save('nc_cfg', cfg);
const T = () => THEMES[cfg.theme];

/* ═════════════ RADARES DA PREFEITURA (publicados em notícias) ═════════════
   As notícias dão "Rua X com Rua Y" ou "perto de tal lugar", sem coordenadas. O app descobre:
     • cross → ponto onde as duas ruas se cruzam no desenho do OSM
     • near  → acha o lugar (Nominatim) e "gruda" no ponto mais próximo da rua
     • só street → ponto exato desconhecido: avisa ao ENTRAR na via ("zona")
   "." no lugar de letra acentuada → funciona com ou sem acento. */
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
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
/* Haversine: distância sobre a esfera. Mede o ÂNGULO central θ e multiplica pelo raio (arco = R·θ).
     h = sen²(Δφ/2) + cos φ1 · cos φ2 · sen²(Δλ/2) ;  θ = 2·asin(√h)      (φ = latitude, λ = longitude) */
function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/* Rumo de A para B (bússola: 0°=N, 90°=L).  y = sen Δλ·cos φ2 ; x = cos φ1·sen φ2 − sen φ1·cos φ2·cos Δλ ; θ = atan2(y,x) */
function bearing(a, b) {
  const φ1 = toRad(a[0]), φ2 = toRad(b[0]), Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
/* menor diferença entre ângulos (350° e 10° → 20°) */
function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
/* Projeção local plana: x = Δλ·cos(φ_ref)·R (longitude "encolhe" longe do Equador) ; y = Δφ·R */
function project(p, ref) { return [toRad(p[1] - ref[1]) * Math.cos(toRad(ref[0])) * R, toRad(p[0] - ref[0]) * R]; }
/* Distância de P ao segmento AB:  t = (AP·AB)/|AB|² preso em [0,1] ; ponto mais próximo C = A + t·AB */
function distToSegment(p, a, b) {
  const A = project(a, p), B = project(b, p), ABx = B[0] - A[0], ABy = B[1] - A[1], len2 = ABx * ABx + ABy * ABy;
  let t = len2 ? -(A[0] * ABx + A[1] * ABy) / len2 : 0; t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(A[0] + t * ABx, A[1] + t * ABy), t };
}
function nearestOnLines(p, lines) {
  let best = { d: Infinity, pt: null, brg: 0 };
  for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) {
    const s = distToSegment(p, ln[i], ln[i + 1]);
    if (s.d < best.d) best = { d: s.d, pt: [ln[i][0] + s.t * (ln[i + 1][0] - ln[i][0]), ln[i][1] + s.t * (ln[i + 1][1] - ln[i][1])], brg: bearing(ln[i], ln[i + 1]) };
  }
  return best;
}
const ll = p => [p[1], p[0]];              // [lat,lon] → [lon,lat] (o MapLibre usa lon primeiro)

/* ═════════════ ESTADO ═════════════ */
const S = {
  pos: null, prevPos: null, speed: 0, heading: null, acc: null, lastFixT: 0, follow: true,
  city: { radars: [], zones: [], signals: [], missing: [] },
  reports: load('nc_reports', []), overrides: load('nc_overrides', {}),
  route: null, navigating: false, along: 0, segIdx: 0, offCount: 0, lastReroute: 0, trip: null, dest: null,
  alerted: {}, activeAlert: null, zoneState: {}, pickFor: null,
  road: null, overCount: 0, lastSpeedAlert: 0, spokeOver: false,
};
function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ═════════════ SOM ═════════════
   O "piririn" é um arpejo: 3 notas subindo rapidinho (ex.: Mi6 → Sol6 → Dó7 ≈ 1318 → 1568 → 2093 Hz).
   Cada nota tem "envelope": sobe em 5 ms e decai exponencialmente → soa como um sininho eletrônico.
   O tema escolhe o TIMBRE (onda quadrada = 8-bit/cyber, senoide = sino, triângulo = arcade).
   No sino somamos um 2º harmônico em 2,76× a frequência (é o que dá o "brilho" metálico de um sino). */
let audioCtx = null;
function initAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {} }
function tone(freq, t0, dur, decay, wave, gainV, bell) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = wave; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainV, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + decay);
  o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + dur + decay + 0.02);
  if (bell) tone(freq * 2.76, t0, dur * 0.6, decay * 0.5, 'sine', gainV * 0.35, false);
}
function alertSound(kind) {
  if (cfg.muted || !audioCtx || cfg.volume <= 0) return;
  audioCtx.resume?.();
  const th = T().sound; let notes = th.notes.slice(), wave = th.wave, dur = th.dur, gap = th.gap, decay = th.decay, bell = !!th.bell, reps = 1;
  if (cfg.sound === 'beep') notes = [th.notes[1], th.notes[1]];
  if (cfg.sound === 'bell') { wave = 'sine'; bell = true; dur = 0.28; decay = 0.5; notes = [th.notes[0], th.notes[2]]; }
  if (kind === 'speed') reps = 2;                       // piririn piririn
  if (kind === 'hazard') notes.reverse();               // descendo = "atenção"
  if (kind === 'turn') { notes = [notes[0]]; dur = 0.06; }
  if (kind === 'ui') { notes = [notes[notes.length - 1]]; dur = 0.04; decay = 0.05; }
  const vol = 0.22 * cfg.volume * (wave === 'sine' ? 1.6 : wave === 'triangle' ? 1.3 : 1);   // ondas "macias" precisam de mais ganho
  let t = audioCtx.currentTime + 0.02;
  for (let r = 0; r < reps; r++) { for (const f of notes) { tone(f, t, dur, decay, wave, vol, bell); t += dur + gap; } t += 0.14; }
}
function speak(text) {
  if (cfg.muted || !cfg.voice) return;
  if (window.Android && Android.speak) { Android.speak(text); return; }
  if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
}
function vibrate(ms) { if (!cfg.vibrate) return; if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); }
let toastT;
function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ═════════════ MAPA ═════════════ */
let bootLogDone = false;
let map = null, mapReady = false, player = null, mapSrc = CFG.tiles.source, mapGlyphs = CFG.tiles.glyphs;
const markers = { radar: [], report: [], dest: null };

async function initMap() {
  try {   // endereços oficiais dos dados/fontes do OpenFreeMap (se mudarem, o app acompanha)
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const base = await (await fetch(CFG.tiles.style, { signal: ctl.signal })).json();
    const k = Object.keys(base.sources).find(s => base.sources[s].type === 'vector');
    if (k) mapSrc = base.sources[k];
    if (base.glyphs) mapGlyphs = base.glyphs;
  } catch (e) { console.warn('estilo base indisponível, usando padrão', e); }
  map = new maplibregl.Map({
    container: 'map', style: buildStyle(T(), mapSrc, mapGlyphs, cfg),
    center: ll(CFG.center), zoom: 15, pitch: cfg.mode3d ? 55 : 0, maxPitch: 70,
    attributionControl: { compact: true, customAttribution: 'OSRM · Nominatim' },
  });
  map.on('style.load', addOverlays);       // dispara no início e a cada troca de tema
  map.on('error', e => console.warn('map', e?.error?.message || e));
  ['dragstart', 'rotatestart', 'pitchstart'].forEach(ev => map.on(ev, e => { if (e.originalEvent) setFollow(false); }));
  map.on('contextmenu', e => openReportMenu([e.lngLat.lat, e.lngLat.lng]));
  map.on('click', e => {
    if (!S.pickFor) return;
    S.overrides[S.pickFor] = [e.lngLat.lat, e.lngLat.lng]; save('nc_overrides', S.overrides);
    S.pickFor = null; toast('Posição do radar corrigida'); renderCity();
  });
  setupLongPress();
}

/* Camadas "nossas" por cima do mapa base: rota, vias com radar, semáforos */
function addOverlays() {
  const th = T(), empty = { type: 'FeatureCollection', features: [] };
  for (const id of ['zones', 'signals', 'route']) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty });
  map.addLayer({ id: 'zones', type: 'line', source: 'zones', layout: { visibility: cfg.showZones ? 'visible' : 'none' },
    paint: { 'line-color': th.zone, 'line-width': 5, 'line-opacity': 0.55, 'line-dasharray': [2, 1.5] } }, 'road-label');
  map.addLayer({ id: 'signals', type: 'circle', source: 'signals', minzoom: 15, layout: { visibility: cfg.showSignals ? 'visible' : 'none' },
    paint: { 'circle-radius': 3.5, 'circle-color': th.signal, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } }, 'road-label');
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': th.route.glow, 'line-width': 18, 'line-blur': 10, 'line-opacity': th.route.dash ? 0 : 0.55 } }, 'road-label');
  const core = { 'line-color': th.route.core, 'line-width': th.route.dash ? 5 : 6 };
  if (th.route.dash) core['line-dasharray'] = th.route.dash;
  map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': th.route.dash ? 'butt' : 'round', 'line-join': 'round' }, paint: core }, 'road-label');
  mapReady = true;
  renderCity(); renderReports(); drawRoute();
  if (player) { player.remove(); player = null; }
  if (S.pos) placePlayer(true);
}
function applyTheme(id) {
  cfg.theme = id; saveCfg();
  document.body.dataset.theme = id;
  const b = T().boot;
  $('bootTitle').textContent = b.title; $('bootTitle').dataset.text = b.title;
  $('bootSub').textContent = b.sub; $('bootBtn').textContent = b.btn;
  $('brandSmall').textContent = b.title; $('brandSmall').dataset.text = b.title;
  document.querySelectorAll('.tcard').forEach(c => c.classList.toggle('on', c.dataset.t === id));
  if (bootLogDone) $('bootlog').textContent = b.log.join('\n') + '\n';
  if (map) { mapReady = false; map.setStyle(buildStyle(T(), mapSrc, mapGlyphs, cfg), { diff: false }); }
}
function rebuildMap() { if (map) { mapReady = false; map.setStyle(buildStyle(T(), mapSrc, mapGlyphs, cfg), { diff: false }); } }

/* Câmera de GPS de carro: inclinada 60°, girando com você, e você um pouco abaixo do centro
   (deslocamento de 20% da altura da tela) para enxergar mais o que vem pela frente. */
function followCamera() {
  if (!S.follow || !mapReady || !S.pos) return;
  const o = { center: ll(S.pos), duration: 900, essential: true };
  if (cfg.mode3d) {
    o.pitch = 60; o.zoom = S.navigating ? cfg.navZoom : Math.max(map.getZoom(), 16);
    if (S.heading != null && S.speed > 4) o.bearing = S.heading;
    o.offset = [0, map.getContainer().clientHeight * 0.2];
  } else { o.pitch = 0; o.bearing = 0; if (S.navigating) o.zoom = cfg.navZoom; }
  map.easeTo(o);
}

/* ═════════════ ABERTURA ═════════════ */
function themeCards(container, big) {
  container.innerHTML = '';
  for (const [id, th] of Object.entries(THEMES)) {
    const b = document.createElement('button'); b.className = 'tcard' + (id === cfg.theme ? ' on' : ''); b.dataset.t = id;
    b.innerHTML = `<div class="sw" style="background:${th.preview}"></div><span>${th.name}</span>${big ? `<small>${th.tag}</small>` : ''}`;
    b.onclick = () => { initAudio(); applyTheme(id); alertSound('ui'); };
    container.appendChild(b);
  }
}
(function boot() {
  applyTheme(cfg.theme);
  themeCards($('bootThemes'), false);
  const lines = T().boot.log; let i = 0;
  const tick = setInterval(() => { if (i >= lines.length) { bootLogDone = true; return clearInterval(tick); } $('bootlog').textContent += T().boot.log[i++] + '\n'; }, 260);
  $('jackin').onclick = () => {
    initAudio(); alertSound('ui');
    $('boot').classList.add('hidden');
    if (map) map.resize();
    startLocation(); loadCityData(false);
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
function setGps(txt, bad) { const g = $('gpsStatus'); g.textContent = 'GPS ' + txt; g.classList.toggle('bad', !!bad); }

function onLocation(lat, lon, speedMs, head, acc) {
  const p = [lat, lon];
  S.acc = acc; setGps(acc ? `±${Math.round(acc)}m` : 'OK', acc > 50);
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
  if (mapReady) placePlayer(first);
  checkRadars();
  updateRoad();
  checkSpeed();
  if (S.route) updateNavigation();
}
function placePlayer(jump) {
  if (!player) {
    const d = document.createElement('div'); d.className = 'player'; const c = T().player;
    d.innerHTML = `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="2"/>
      <path d="M24 9 L34 34 L24 28 L14 34 Z" fill="${c}" stroke="#fff" stroke-width="1.6"/></svg>`;
    player = new maplibregl.Marker({ element: d, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(ll(S.pos)).addTo(map);
  }
  player.setLngLat(ll(S.pos));
  if (S.heading != null) player.setRotation(S.heading);
  if (jump) map.jumpTo({ center: ll(S.pos), zoom: 17 });
  followCamera();
}

/* ═════════════ VIA ATUAL E LIMITE DE VELOCIDADE ═════════════
   Pergunta ao OSM "quais ruas existem num raio de 250 m?" (com desenho e etiquetas) e guarda.
   A cada posição, escolhe a rua que melhor combina comigo:
     pontuação = distância até o eixo (m) + penalidade de direção (até 15 m se a rua "corre" de lado)
   Limite: etiqueta maxspeed do OSM. Se a rua não tiver, usa o padrão do CTB (art. 61) pelo tipo de via:
     via local 30 · coletora 40 · arterial 60 · trânsito rápido 80 · rodovia de pista dupla 110  (marcado "est.") */
const ROAD = { ways: new Map(), lastQ: null, lastQT: 0, busy: false };
const HW = '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$';
const CTB = { motorway: 110, trunk: 80, primary: 60, secondary: 60, tertiary: 40, unclassified: 40, residential: 30, living_street: 30, service: 30,
              motorway_link: 60, trunk_link: 40, primary_link: 40, secondary_link: 40, tertiary_link: 40 };
async function fetchRoads() {
  ROAD.busy = true; ROAD.lastQ = S.pos; ROAD.lastQT = Date.now();
  try {
    const els = await overpass(`[out:json][timeout:15];way(around:250,${S.pos[0]},${S.pos[1]})["highway"~"${HW}"];out tags geom;`);
    for (const w of els) if (w.type === 'way' && w.geometry) {
      const g = w.geometry.map(p => [p.lat, p.lon]);
      const lats = g.map(p => p[0]), lons = g.map(p => p[1]);
      ROAD.ways.set(w.id, { name: w.tags.name || w.tags.ref || '', hw: w.tags.highway, maxspeed: w.tags.maxspeed, geom: g,
        box: [Math.min(...lats) - 3e-4, Math.min(...lons) - 3e-4, Math.max(...lats) + 3e-4, Math.max(...lons) + 3e-4] });
    }
    if (ROAD.ways.size > 3000) [...ROAD.ways.keys()].slice(0, 1000).forEach(k => ROAD.ways.delete(k));   // limita a memória
  } catch (e) { console.warn('roads', e); }
  ROAD.busy = false;
}
function matchRoad() {
  let best = null;
  for (const w of ROAD.ways.values()) {
    const p = S.pos; if (p[0] < w.box[0] || p[0] > w.box[2] || p[1] < w.box[1] || p[1] > w.box[3]) continue;
    const nb = nearestOnLines(p, [w.geom]);
    let score = nb.d;
    if (S.heading != null && S.speed > 8) score += Math.min(angleDiff(nb.brg, S.heading), angleDiff((nb.brg + 180) % 360, S.heading)) / 90 * 15;
    if (!best || score < best.score) best = { ...w, d: nb.d, score };
  }
  return best;
}
function updateRoad() {
  const m = matchRoad();
  if (m && m.d < 25) {
    const tag = parseInt(String(m.maxspeed || '').match(/\d+/)?.[0]);
    S.road = { name: m.name, limit: tag || CTB[m.hw] || null, est: !tag };
  } else S.road = null;
  const needFetch = !m || m.d > 25 || !ROAD.lastQ || haversine(ROAD.lastQ, S.pos) > 180;
  if (needFetch && !ROAD.busy && Date.now() - ROAD.lastQT > 8000) fetchRoads().then(() => { updateRoad(); checkSpeed(); });
  const rn = $('roadName');
  rn.classList.toggle('hidden', !S.road?.name);
  if (S.road?.name) rn.textContent = S.road.name;
}

/* Limite que vale agora: o do radar à frente (se houver) ou o da via */
function currentLimit() {
  if (S.activeAlert?.limit) return { v: S.activeAlert.limit, est: false };
  if (S.road?.limit) return { v: S.road.limit, est: S.road.est };
  return null;
}
/* Excesso: acima do limite + tolerância em 2 leituras seguidas (evita alarme por "pulo" do GPS).
   Repete o piririn a cada 12 s enquanto continuar acima. */
function checkSpeed() {
  const v = Math.round(S.speed), lim = currentLimit();
  $('spVal').textContent = v;
  $('spArc').style.strokeDasharray = `${(235.6 * Math.min(v / 160, 1)).toFixed(1)} 314.2`;   // 270° de 2π·50 ≈ 235,6
  $('spLimit').classList.toggle('hidden', !lim);
  if (lim) { $('spLimitVal').textContent = lim.v; $('spLimitEst').classList.toggle('hidden', !lim.est); }
  const active = lim && cfg.speedWarn && (!lim.est || cfg.warnEstimated);
  const over = active && v > lim.v + cfg.tolerance;
  $('speedo').classList.toggle('over', !!(lim && v > lim.v));
  if (!over) { S.overCount = 0; S.spokeOver = false; return; }
  S.overCount++;
  if (S.overCount >= 2 && Date.now() - S.lastSpeedAlert > 12000) {
    S.lastSpeedAlert = Date.now(); alertSound('speed'); vibrate(300);
    if (!S.spokeOver) { S.spokeOver = true; setTimeout(() => speak(`Acima do limite de ${lim.v}`), 900); }
  }
}

/* ═════════════ DADOS DA CIDADE ═════════════ */
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
  toast('Mapeando radares e semáforos de Hortolândia...', 6000);
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
  catch { if (cache) { S.city = cache.data; renderCity(); } toast('Sem conexão com o OpenStreetMap — tente de novo pelo menu'); return; }
  const ways = els.filter(x => x.type === 'way' && x.geometry && x.tags?.name).map(x => ({ name: x.tags.name, nodes: x.nodes, geom: x.geometry.map(g => [g.lat, g.lon]) }));
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
  toast(`${radars.length} radares · ${zones.length} vias com radar · ${signals.length} semáforos`, 4500);
  if (S.route) markRouteSignals();
}
/* Cruzamento: ruas que se cruzam no OSM compartilham um "nó" (mesmo id).
   Se não (viaduto/passagem inferior), usa o par de pontos mais próximo (< 80 m). */
function intersect(A, B) {
  if (!B.length) return null;
  for (const a of A) { const ids = new Map(a.nodes.map((id, i) => [id, a.geom[i]])); for (const b of B) for (const id of b.nodes) if (ids.has(id)) return ids.get(id); }
  let best = { d: Infinity, pt: null };
  for (const a of A) for (const p of a.geom) { const nb = nearestOnLines(p, B.map(b => b.geom)); if (nb.d < best.d) best = { d: nb.d, pt: p }; }
  return best.d < 80 ? best.pt : null;
}
function parseCameras(els) {
  const nodes = {}, out = new Map();
  for (const e of els) if (e.type === 'node') nodes[e.id] = e;
  const lim = t => { const m = String(t?.maxspeed || '').match(/\d+/); return m ? +m[0] : null; };
  const mk = (n, l, dir) => ({ id: 'osm' + n.id, lat: n.lat, lon: n.lon, limit: l, osmDir: dir, label: 'Câmera cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
  for (const e of els) {
    if (e.type === 'node' && (e.tags?.highway === 'speed_camera' || e.tags?.enforcement)) out.set(e.id, mk(e, lim(e.tags), e.tags.direction ?? null));
    if (e.type === 'relation' && e.members) {
      const dev = e.members.find(m => m.role === 'device' && m.type === 'node') || e.members.find(m => m.type === 'node');
      const nd = dev && nodes[dev.ref]; if (nd) out.set(nd.id, mk(nd, lim(e.tags) ?? out.get(nd.id)?.limit ?? null, null));
    }
  }
  return [...out.values()];
}
const posOf = r => S.overrides[r.id] || [r.lat, r.lon];
function mkEl(cls, html) { const d = document.createElement('div'); d.innerHTML = `<div class="mk ${cls}">${html}</div>`; return d.firstChild; }
const ico = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
function addMarker(p, el, html) {
  const m = new maplibregl.Marker({ element: el }).setLngLat(ll(p));
  if (html) m.setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(html));
  return m.addTo(map);
}
function renderCity() {
  const c = S.city, userR = S.reports.filter(x => x.type === 'radar').length;
  $('radarCount').textContent = `◉ ${c.radars.length + c.zones.length + userR}`;
  if (!mapReady) return;
  markers.radar.forEach(m => m.remove()); markers.radar = [];
  for (const r of c.radars) {
    const note = S.overrides[r.id] ? ' · corrigido por você' : (r.origin === 'pref' ? ` · posição calculada (${r.how})` : '');
    markers.radar.push(addMarker(posOf(r), mkEl('radar' + (r.origin === 'pref' ? ' pref' : ''), r.limit ?? ico('cam')),
      `<b>Radar ${r.limit ? r.limit + ' km/h' : ''}</b><br>${r.label}${r.dir ? '<br>Sentido ' + r.dir : ''}
       <br><small>Fonte: ${r.src}${note}</small><br><button class="btn" onclick="pickRadar('${r.id}')">Ajustar posição</button>`));
  }
  map.getSource('zones')?.setData({ type: 'FeatureCollection', features: c.zones.flatMap(z => z.lines.map(l => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.map(ll) } }))) });
  map.getSource('signals')?.setData({ type: 'FeatureCollection', features: c.signals.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ll(p) } })) });
}
window.pickRadar = id => { S.pickFor = id; document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); toast('Toque no mapa onde fica esse radar', 5000); };

/* ═════════════ radar.daemon ═════════════ */
const LABEL = { radar: 'Radar', police: 'Polícia', accident: 'Acidente', hazard: 'Perigo' };
function checkRadars() {
  if (!S.pos) return;
  let best = null;
  for (const r of [...S.city.radars.map(r => ({ ...r, type: 'radar' })), ...S.reports]) {
    const p = posOf(r), d = haversine(S.pos, p);
    if (d > cfg.radarDist + 150) { delete S.alerted[r.id]; continue; }
    if (d > cfg.radarDist) continue;
    // está À FRENTE? rumo até o radar comparado com o rumo em que ando (±50°)
    if (S.heading != null && d > 40 && angleDiff(bearing(S.pos, p), S.heading) > CFG.aheadAngle) continue;
    if (r.osmDir != null && !isNaN(+r.osmDir) && S.heading != null && angleDiff(+r.osmDir, S.heading) > 60) continue;
    if (!best || d < best.d) best = { ...r, d };
  }
  if (!best && S.speed > 8) best = checkZones();
  showAlert(best);
}
function checkZones() {   // via com radar sem ponto exato: estou a ≤18 m do eixo dela?
  for (const z of S.city.zones) {
    const nb = nearestOnLines(S.pos, z.lines);
    if (nb.d <= CFG.zoneDist + (S.acc || 0) * 0.3) { S.zoneState[z.id] = Date.now(); return { ...z, type: 'zone', d: 0 }; }
  }
  return null;
}
function showAlert(a) {
  S.activeAlert = a && (a.type === 'radar' || a.type === 'zone') ? a : null;
  if (!a) { $('radarAlert').classList.add('hidden'); $('alertFrame').classList.remove('on'); return; }
  const over = a.limit && S.speed > a.limit;
  $('radarAlert').classList.remove('hidden');
  $('raTitle').textContent = a.type === 'zone' ? 'Via com radar' : `${LABEL[a.type]} · ${Math.round(a.d / 10) * 10} m`;
  $('raSub').textContent = a.limit ? (over ? `Reduza! Limite ${a.limit}` : `Limite ${a.limit} km/h`) : 'Atenção à frente';
  $('alertFrame').classList.toggle('on', !!over);
  const st = S.alerted[a.id] || (S.alerted[a.id] = {});
  if (!st.first) {
    st.first = true; alertSound(a.type === 'hazard' || a.type === 'accident' ? 'hazard' : 'radar'); vibrate(400);
    setTimeout(() => speak(a.type === 'zone' ? `Via com radar, limite ${a.limit}` : `${LABEL[a.type].toLowerCase()} em ${Math.round(a.d / 50) * 50} metros${a.limit ? ', limite ' + a.limit : ''}`), 600);
  }
  if (a.type === 'zone') setTimeout(() => { if (Date.now() - (S.zoneState[a.id] || 0) > 30000) delete S.alerted[a.id]; }, 31000);
}

/* ═════════════ REPORTES (toque longo) ═════════════ */
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
  const btn = e.target.closest('[data-type]'); if (!btn) return;
  const type = btn.dataset.type;
  $('reportMenu').classList.add('hidden');
  if (type === 'close' || !pendingP) return;
  if (type === 'route') return routeTo(pendingP, 'Ponto no mapa');
  S.reports.push({ id: 'u' + Date.now(), type, lat: pendingP[0], lon: pendingP[1], limit: type === 'radar' ? +$('rmSpeed').value : null, t: Date.now() });
  save('nc_reports', S.reports); renderReports(); renderCity(); alertSound('ui'); toast(`${LABEL[type]} marcado`);
});
const ICON = { radar: 'cam', police: 'shield', accident: 'crash', hazard: 'warn' };
function renderReports() {
  if (!mapReady) return;
  markers.report.forEach(m => m.remove()); markers.report = [];
  for (const r of S.reports) {
    const el = r.type === 'radar' ? mkEl('radar user', r.limit ?? ico('cam')) : mkEl(r.type, ico(ICON[r.type]));
    markers.report.push(addMarker([r.lat, r.lon], el, `<b>${LABEL[r.type]} (seu)</b><br>${r.limit ? 'Limite ' + r.limit + ' km/h<br>' : ''}
      <small>há ${Math.round((Date.now() - r.t) / 3600e3)} h</small><br><button class="btn danger" onclick="delReport('${r.id}')">Remover</button>`));
  }
}
window.delReport = id => { S.reports = S.reports.filter(r => r.id !== id); save('nc_reports', S.reports); renderReports(); renderCity(); document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); };

/* ═════════════ BUSCA ═════════════ */
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
  } catch { toast('Erro na busca — sem internet?'); }
}

/* ═════════════ ROTA ═════════════ */
async function routeTo(dest, name) {
  if (!S.pos) return toast('Aguardando sinal de GPS...');
  S.dest = { p: dest, name };
  try {
    const url = `${CFG.osrm}${S.pos[1]},${S.pos[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`;
    const j = await (await fetch(url)).json();
    if (j.code !== 'Ok' || !j.routes.length) throw new Error(j.code);
    buildRoute(j.routes[0]);
    if (!S.navigating) {
      const b = new maplibregl.LngLatBounds(); S.route.coords.forEach(c => b.extend(ll(c)));
      setFollow(false); map.fitBounds(b, { padding: { top: 190, bottom: 130, left: 50, right: 75 }, pitch: 0, bearing: 0, duration: 800 });
    } else setFollow(true);
  } catch (e) { toast('Não foi possível calcular a rota'); console.warn(e); }
}
function buildRoute(rt) {
  const coords = rt.geometry.coordinates.map(c => [c[1], c[0]]);
  const cum = [0];       // cum[i] = distância acumulada do início até o vértice i
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const steps = rt.legs.flatMap(l => l.steps);
  let k = 0;
  const stepAlong = steps.map(st => {
    const loc = [st.maneuver.location[1], st.maneuver.location[0]]; let bi = k, bd = Infinity;
    for (let i = k; i < coords.length; i++) { const d = haversine(loc, coords[i]); if (d < bd) { bd = d; bi = i; } if (d > bd + 300) break; }
    k = bi; return cum[bi];
  });
  S.route = { coords, cum, total: cum[cum.length - 1], duration: rt.duration, steps, stepAlong, said: {}, signalAlong: [] };
  S.segIdx = 0; S.along = 0; S.offCount = 0;
  if (S.trip) S.trip.lastAlong = 0;
  markRouteSignals(); drawRoute();
  $('tripBar').classList.remove('hidden');
  $('bGo').classList.toggle('hidden', S.navigating);
  updateTrip(); updateNavigation();
}
function drawRoute() {
  if (!mapReady) return;
  map.getSource('route')?.setData(S.route ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: S.route.coords.map(ll) } } : { type: 'FeatureCollection', features: [] });
  markers.dest?.remove(); markers.dest = null;
  if (S.dest) markers.dest = addMarker(S.dest.p, mkEl('dest', ico('flag')), `<b>Destino</b><br>${S.dest.name}`);
}
function markRouteSignals() {   // semáforos a ≤20 m da linha da rota → "em que metro da rota" cada um fica
  const r = S.route; if (!r) return;
  const lats = r.coords.map(c => c[0]), lons = r.coords.map(c => c[1]), pad = 4e-4;
  const box = [Math.min(...lats) - pad, Math.min(...lons) - pad, Math.max(...lats) + pad, Math.max(...lons) + pad];
  r.signalAlong = [];
  for (const sg of S.city.signals) {
    if (sg[0] < box[0] || sg[0] > box[2] || sg[1] < box[1] || sg[1] > box[3]) continue;
    let best = { d: Infinity, a: 0 };
    for (let i = 0; i < r.coords.length - 1; i++) { const s = distToSegment(sg, r.coords[i], r.coords[i + 1]); if (s.d < best.d) best = { d: s.d, a: r.cum[i] + s.t * (r.cum[i + 1] - r.cum[i]) }; }
    if (best.d <= 20) r.signalAlong.push(best.a);
  }
  r.signalAlong.sort((a, b) => a - b); updateTrip();
}

/* ═════════════ TEMPO DE CHEGADA ═════════════
   1) Horário: tempo rodando × (pico 1,35 · dia 1,15 · noite 1,00)
   2) Semáforos — valor esperado: ciclo ~80 s, verde ~45% → P(vermelho) ≈ 0,55;
      pegando vermelho, espero em média metade dele (≈22 s) + ~5 s de frear/arrancar
      → E[atraso] ≈ 0,55 × 27 ≈ 15 s por semáforo (pico ~22 s); desconta os ~2 s que o OSRM já conta
   3) Ao vivo: t = (1 − w)·previsto + w·(restante × seu ritmo real), w cresce até 0,5 */
function trafficFactor(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60, wd = d.getDay() >= 1 && d.getDay() <= 5;
  if (wd && ((h >= 6.5 && h < 9) || (h >= 17 && h < 19.5))) return { f: 1.35, sig: 22, label: 'horário de pico' };
  if (h >= 6 && h < 21) return { f: 1.15, sig: 15, label: 'trânsito normal' };
  return { f: 1.0, sig: 12, label: 'trânsito livre' };
}
function estimate() {
  const r = S.route, rem = Math.max(0, r.total - S.along), tf = trafficFactor();
  const sigAhead = r.signalAlong.filter(a => a > S.along + 10).length;
  if (!cfg.smartEta) return { t: r.duration * rem / r.total, rem, drive: r.duration * rem / r.total, sigAhead, sigTime: 0, tf: { label: 'estimativa simples' }, live: null };
  const drive = r.duration * (rem / r.total) * tf.f, sigTime = sigAhead * (tf.sig - 2);
  let t = drive + sigTime, live = null;
  if (S.navigating && S.trip && S.trip.dist > 400) {
    const pace = (Date.now() - S.trip.t0) / 1000 / S.trip.dist, w = Math.min(S.trip.dist / 4000, 0.5);
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
$('tbEtaCell').onclick = () => {
  if (!S.route) return; const E = estimate();
  toast(`Rodando ${Math.round(E.drive / 60)} min (${E.tf.label}) + ${E.sigAhead} semáforos ≈ ${Math.round(E.sigTime / 60)} min` + (E.live ? ` · ajustado pelo seu ritmo (${Math.round(E.live.w * 100)}%)` : ''), 6000);
};
function updateNavigation() {
  const r = S.route; if (!r || !S.pos) return;
  let best = { d: Infinity, i: S.segIdx, t: 0 };
  const from = Math.max(0, S.segIdx - 5), to = Math.min(r.coords.length - 1, S.segIdx + 80);
  for (let i = from; i < to; i++) { const s = distToSegment(S.pos, r.coords[i], r.coords[i + 1]); if (s.d < best.d) best = { d: s.d, i, t: s.t }; }
  S.segIdx = best.i;
  S.along = r.cum[best.i] + best.t * (r.cum[best.i + 1] - r.cum[best.i]);
  if (S.navigating && S.trip) { S.trip.dist += Math.max(0, Math.min(S.along - S.trip.lastAlong, 200)); S.trip.lastAlong = S.along; }
  updateTrip();
  if (best.d > CFG.offRouteDist + (S.acc || 0) * 0.5) S.offCount++; else S.offCount = 0;
  if (S.navigating && cfg.autoReroute && S.offCount >= 3 && Date.now() - S.lastReroute > 15000) {
    S.lastReroute = Date.now(); S.offCount = 0; speak('Recalculando rota'); toast('Recalculando...'); routeTo(S.dest.p, S.dest.name); return;
  }
  if (haversine(S.pos, S.dest.p) < 30) { speak('Você chegou ao destino'); alertSound('radar'); toast('Destino alcançado'); cancelRoute(); return; }
  let k = r.stepAlong.findIndex((a, i) => i > 0 && a > S.along + 5); if (k < 0) k = r.steps.length - 1;
  const step = r.steps[k], dist = r.stepAlong[k] - S.along;
  $('maneuver').classList.toggle('hidden', !S.navigating);
  $('mArrow').textContent = arrowFor(step);
  $('mDist').textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 10) * 10 + ' m';
  $('mInstr').textContent = instr(step);
  if (!S.navigating) return;
  const said = r.said[k] || (r.said[k] = {});
  if (dist < 500 && dist > 250 && !said.far) { said.far = true; speak(`Em ${Math.round(dist / 100) * 100} metros, ${instr(step)}`); }
  else if (dist < 150 && dist > 50 && !said.near) { said.near = true; speak(`Em ${Math.round(dist / 10) * 10} metros, ${instr(step)}`); }
  else if (dist <= 35 && !said.now) { said.now = true; alertSound('turn'); speak(instr(step)); }
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
  drawRoute();
  $('tripBar').classList.add('hidden'); $('maneuver').classList.add('hidden');
  setFollow(true);
}

/* ═════════════ CONFIGURAÇÕES ═════════════ */
const SETTINGS = [
  { sec: 'Tema', themes: true },
  { sec: 'Avisos', items: [
    { k: 'speedWarn', t: 'Avisar quando passar do limite da via', d: 'Toca o "piririn" e fala o limite', type: 'toggle' },
    { k: 'tolerance', t: 'Tolerância', d: 'Quanto acima do limite antes de avisar', type: 'select', opts: [[0, 'Nenhuma'], [5, '+5 km/h'], [7, '+7 km/h (margem do radar)'], [10, '+10 km/h']] },
    { k: 'warnEstimated', t: 'Usar limite estimado', d: 'Quando a rua não tem limite cadastrado, usa o padrão do CTB pelo tipo de via (ex.: rua de bairro 30)', type: 'toggle' },
    { k: 'radarDist', t: 'Avisar radar a', type: 'select', opts: [[250, '250 m'], [400, '400 m'], [600, '600 m']] },
    { k: 'sound', t: 'Som do aviso', type: 'select', opts: [['piririn', 'Piririn'], ['beep', 'Bipe duplo'], ['bell', 'Sino']], test: true },
    { k: 'volume', t: 'Volume dos avisos', type: 'range', min: 0, max: 1, step: 0.05 },
    { k: 'voice', t: 'Voz', d: 'Instruções de rota e alertas falados', type: 'toggle' },
    { k: 'vibrate', t: 'Vibrar nos alertas', type: 'toggle' },
  ] },
  { sec: 'Mapa', items: [
    { k: 'mode3d', t: 'Câmera 3D', d: 'Inclinada e girando junto com o carro', type: 'toggle' },
    { k: 'buildings3d', t: 'Prédios em 3D', d: 'Desligue se o celular esquentar ou travar', type: 'toggle' },
    { k: 'navZoom', t: 'Zoom durante a navegação', type: 'range', min: 15.5, max: 18.5, step: 0.1 },
    { k: 'showSignals', t: 'Mostrar semáforos', type: 'toggle' },
    { k: 'showZones', t: 'Mostrar vias com radar', type: 'toggle' },
  ] },
  { sec: 'Navegação', items: [
    { k: 'autoReroute', t: 'Recalcular rota sozinho', type: 'toggle' },
    { k: 'smartEta', t: 'Tempo de chegada inteligente', d: 'Considera horário de pico e semáforos', type: 'toggle' },
  ] },
  { sec: 'Dados', items: [
    { t: 'Atualizar radares e semáforos', type: 'button', act: () => { closeSheet(); loadCityData(true); } },
    { t: 'Apagar minhas marcações', type: 'button', danger: true, act: () => { if (confirm('Apagar todas as suas marcações e correções de radar?')) { S.reports = []; S.overrides = {}; save('nc_reports', []); save('nc_overrides', {}); renderReports(); renderCity(); toast('Marcações apagadas'); } } },
    { t: 'Restaurar configurações padrão', type: 'button', act: () => { const th = cfg.theme; Object.assign(cfg, DEFAULTS, { theme: th }); saveCfg(); onSetting('buildings3d'); buildSheet(); toast('Padrões restaurados'); } },
  ] },
];
function onSetting(k) {
  saveCfg();
  if (k === 'buildings3d') rebuildMap();
  if (k === 'mode3d') { $('b3d').textContent = cfg.mode3d ? '3D' : '2D'; followCamera(); if (!S.follow && mapReady) map.easeTo({ pitch: cfg.mode3d ? 60 : 0 }); }
  if (k === 'showSignals' && mapReady) map.setLayoutProperty('signals', 'visibility', cfg.showSignals ? 'visible' : 'none');
  if (k === 'showZones' && mapReady) map.setLayoutProperty('zones', 'visibility', cfg.showZones ? 'visible' : 'none');
  if (k === 'smartEta') updateTrip();
  if (k === 'speedWarn' || k === 'tolerance' || k === 'warnEstimated') checkSpeed();
}
function buildSheet() {
  const body = $('sheetBody'); body.innerHTML = '';
  for (const sec of SETTINGS) {
    const s = document.createElement('div'); s.className = 'sec'; s.innerHTML = `<h3>${sec.sec}</h3>`; body.appendChild(s);
    if (sec.themes) { const g = document.createElement('div'); g.className = 'themes'; s.appendChild(g); themeCards(g, true); continue; }
    for (const it of sec.items) {
      if (it.type === 'button') { const b = document.createElement('button'); b.className = 'btn wide' + (it.danger ? ' danger' : ''); b.textContent = it.t; b.onclick = it.act; s.appendChild(b); continue; }
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<div class="lbl">${it.t}${it.d ? `<small>${it.d}</small>` : ''}</div>`;
      let ctl;
      if (it.type === 'toggle') { ctl = document.createElement('button'); ctl.className = 'tgl' + (cfg[it.k] ? ' on' : ''); ctl.setAttribute('aria-label', it.t);
        ctl.onclick = () => { cfg[it.k] = !cfg[it.k]; ctl.classList.toggle('on', cfg[it.k]); alertSound('ui'); onSetting(it.k); }; }
      if (it.type === 'select') { ctl = document.createElement('select'); ctl.innerHTML = it.opts.map(([v, l]) => `<option value="${v}" ${String(cfg[it.k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
        ctl.onchange = () => { cfg[it.k] = typeof it.opts[0][0] === 'number' ? +ctl.value : ctl.value; onSetting(it.k); if (it.test) alertSound('speed'); }; }
      if (it.type === 'range') { ctl = document.createElement('input'); ctl.type = 'range'; ctl.min = it.min; ctl.max = it.max; ctl.step = it.step; ctl.value = cfg[it.k];
        ctl.oninput = () => { cfg[it.k] = +ctl.value; onSetting(it.k); }; ctl.onchange = () => { if (it.k === 'volume') alertSound('speed'); }; }
      row.appendChild(ctl); s.appendChild(row);
    }
  }
  const about = document.createElement('div'); about.className = 'about';
  about.innerHTML = 'Mapa © OpenFreeMap · © OpenMapTiles · © colaboradores do OpenStreetMap. Rotas: OSRM. Busca: Nominatim.<br>Radares da prefeitura vêm de notícias públicas e podem estar desatualizados — dirija sempre respeitando a sinalização.';
  body.appendChild(about);
}
function openSheet() { initAudio(); buildSheet(); $('sheetBack').classList.remove('hidden'); requestAnimationFrame(() => $('sheet').classList.add('open')); }
function closeSheet() { $('sheet').classList.remove('open'); $('sheetBack').classList.add('hidden'); }
$('bMenu').onclick = openSheet;
$('sheetClose').onclick = closeSheet;
$('sheetBack').onclick = closeSheet;

/* ═════════════ BOTÕES ═════════════ */
function setFollow(on) { S.follow = on; $('bFollow').classList.toggle('active', on); if (on) followCamera(); }
$('bFollow').onclick = () => setFollow(!S.follow);
$('b3d').onclick = () => { cfg.mode3d = !cfg.mode3d; onSetting('mode3d'); };
$('bMute').onclick = () => { cfg.muted = !cfg.muted; saveCfg(); $('muteIcon').setAttribute('href', cfg.muted ? '#i-mute' : '#i-vol'); toast(cfg.muted ? 'Sons e voz desligados' : 'Sons e voz ligados'); };
$('bGo').onclick = () => {
  S.navigating = true; S.trip = { t0: Date.now(), dist: 0, lastAlong: S.along };
  $('bGo').classList.add('hidden'); setFollow(true); alertSound('ui'); speak('Rota iniciada. ' + instr(S.route.steps[0])); updateNavigation();
};
$('bCancel').onclick = cancelRoute;
$('b3d').textContent = cfg.mode3d ? '3D' : '2D';
$('muteIcon').setAttribute('href', cfg.muted ? '#i-mute' : '#i-vol');
initMap();
