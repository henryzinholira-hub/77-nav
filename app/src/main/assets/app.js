/* ════════════════════════════════════════════════════════════════════
   NIGHTCITY//NAV — lógica do app
   ────────────────────────────────────────────────────────────────────
   Peças (pense num carro de Night City):
     🛰  GPS ............ os "olhos"   → onde estou, a que velocidade, pra onde aponto
     🗺  Leaflet ........ o "para-brisa" → desenha o mapa e os ícones
     ◉  Overpass (OSM) . o "informante" → lista de radares mapeados na região
     ⌖  Nominatim ...... a "lista telefônica" → transforma endereço em coordenada
     ➤  OSRM ........... o "copiloto" → calcula a rota e as manobras
     🔊 TTS nativo ...... a "voz" → fala as curvas e os alertas
   Tudo grátis e sem chave de API.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

/* ───────────── CONFIGURAÇÃO ───────────── */
const CFG = {
  center: [-22.858, -47.220],               // centro aproximado de Hortolândia
  // caixa da região [sul, oeste, norte, leste] — pega Hortolândia + rodovias vizinhas
  bbox: [-22.93, -47.31, -22.79, -47.12],
  alertDist: 400,          // começa a avisar o radar a 400 m
  aheadAngle: 50,          // radar só conta se estiver até ±50° da direção em que ando
  offRouteDist: 60,        // >60 m longe da linha da rota = saiu da rota
  radarCacheHours: 72,
  overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
  nominatim: 'https://nominatim.openstreetmap.org/search',
  osrm: 'https://router.project-osrm.org/route/v1/driving/',
};

/* ═════════════ GEOMETRIA (a matemática por trás) ═════════════ */
const R = 6371000;                         // raio médio da Terra em metros
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

/* Haversine: distância "em linha reta" sobre a esfera.
   Ideia: em vez de régua, medimos o ÂNGULO central entre os 2 pontos
   e multiplicamos pelo raio (arco = R·θ).
     h = sen²(Δφ/2) + cos φ1 · cos φ2 · sen²(Δλ/2)   (φ = latitude, λ = longitude)
     θ = 2·asin(√h)      →  d = R·θ                                       */
function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Rumo (bearing) de A para B, em graus a partir do Norte, sentido horário.
   É o ângulo de uma "bússola": 0°=N, 90°=L, 180°=S, 270°=O.
     y = sen Δλ · cos φ2
     x = cos φ1 · sen φ2 − sen φ1 · cos φ2 · cos Δλ
     θ = atan2(y, x)   → normaliza para 0..360                          */
function bearing(a, b) {
  const φ1 = toRad(a[0]), φ2 = toRad(b[0]), Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* Menor diferença entre dois ângulos (ex.: 350° e 10° diferem 20°, não 340°) */
function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

/* Projeção "equiretangular" local: numa área pequena (uma cidade) a Terra
   é quase plana, então convertemos graus → metros num plano x/y:
     x = Δλ · cos(φ_ref) · R   (longitude "encolhe" longe do Equador → cos φ)
     y = Δφ · R                                                            */
function project(p, ref) {
  return [toRad(p[1] - ref[1]) * Math.cos(toRad(ref[0])) * R, toRad(p[0] - ref[0]) * R];
}

/* Distância de um ponto P a um segmento AB (no plano, com P na origem).
   t = projeção de P sobre a reta AB, normalizada 0..1:
     t = (AP · AB) / |AB|²    → limitado a [0,1] para ficar DENTRO do segmento
   O ponto mais próximo é C = A + t·AB, e a distância é |C|.             */
function distToSegment(p, a, b) {
  const A = project(a, p), B = project(b, p);
  const ABx = B[0] - A[0], ABy = B[1] - A[1];
  const len2 = ABx * ABx + ABy * ABy;
  let t = len2 ? -(A[0] * ABx + A[1] * ABy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(A[0] + t * ABx, A[1] + t * ABy), t };
}

/* ═════════════ ESTADO ═════════════ */
const S = {
  pos: null, prevPos: null, speed: 0, heading: null, acc: null,
  follow: true, muted: false,
  radars: [],          // radares do OpenStreetMap
  reports: load('nc_reports', []),   // pontos que VOCÊ marcou (radar, polícia...)
  route: null,         // {coords, cum, total, duration, steps, stepAlong}
  navigating: false, along: 0, segIdx: 0, offCount: 0, lastReroute: 0,
  dest: null, alerted: {}, activeAlert: null,
};
function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const $ = id => document.getElementById(id);

/* ═════════════ MAPA ═════════════ */
const map = L.map('map', { zoomControl: false, attributionControl: true, tap: false }).setView(CFG.center, 15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd', maxZoom: 20,
  attribution: '© OpenStreetMap · © CARTO · OSRM',
}).addTo(map);

const radarLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
let routeGlow = null, routeLine = null, destMarker = null;

// seta do jogador (SVG) — gira conforme o rumo
const playerIcon = L.divIcon({
  className: 'player', iconSize: [44, 44], iconAnchor: [22, 22],
  html: `<svg id="pArrow" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="rgba(0,240,255,.12)" stroke="#00f0ff" stroke-width="1"/>
         <path d="M22 5 L34 36 L22 29 L10 36 Z" fill="#00f0ff" stroke="#fff" stroke-width="1.5"/></svg>`,
});
const player = L.marker(CFG.center, { icon: playerIcon, interactive: false, zIndexOffset: 1000 });

map.on('dragstart', () => setFollow(false));

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
  if (window.Android && Android.speak) { Android.speak(text); return; }   // voz nativa do Android
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
}
function vibrate(ms) { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); }
let toastT;
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ═════════════ BOOT ═════════════ */
(function boot() {
  const lines = ['> carregando kiroshi optics...', '> sincronizando satélites GPS...', '> baixando grid de Hortolândia...', '> radar.daemon ONLINE', '> pronto, choom.'];
  let i = 0; const log = $('bootlog');
  const tick = setInterval(() => { if (i >= lines.length) return clearInterval(tick); log.textContent += lines[i++] + '\n'; }, 280);
  $('jackin').onclick = () => {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    beep(660, 80, 1);
    $('boot').classList.add('hidden');
    map.invalidateSize();
    startLocation();
    loadRadars(false);
    renderReports();
  };
})();

/* ═════════════ LOCALIZAÇÃO ═════════════ */
function startLocation() {
  if (window.Android) return;               // no APK, o Java empurra a posição via onNativeLocation
  if (!navigator.geolocation) return setGps('SEM GPS', true);
  navigator.geolocation.watchPosition(
    p => onLocation(p.coords.latitude, p.coords.longitude, p.coords.speed, p.coords.heading, p.coords.accuracy),
    () => setGps('NEGADO', true),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}
window.onNativeLocation = onLocation;
window.onGpsDenied = () => setGps('NEGADO', true);
function setGps(txt, bad) { const g = $('gpsStatus'); g.textContent = 'GPS: ' + txt; g.classList.toggle('bad', !!bad); }

function onLocation(lat, lon, speedMs, head, acc) {
  const p = [lat, lon];
  S.acc = acc;
  setGps(acc ? `±${Math.round(acc)}m` : 'OK', acc > 50);

  // Velocidade: o GPS dá em m/s.  km/h = m/s × 3,6  (porque 1 m/s = 3600 m/h = 3,6 km/h)
  if (speedMs != null && !isNaN(speedMs)) S.speed = Math.max(0, speedMs * 3.6);
  else if (S.pos && S.lastFixT) {                 // sem velocidade do GPS? calculamos: v = Δd / Δt
    const dt = (Date.now() - S.lastFixT) / 1000;
    if (dt > 0) S.speed = haversine(S.pos, p) / dt * 3.6;
  }
  // Rumo: usa o do GPS se vier e se estiver andando (parado, o rumo do GPS é ruído).
  // Senão, calcula o rumo entre a "âncora" (último ponto a >6 m) e o ponto atual.
  if (!S.prevPos) S.prevPos = p;
  const moved = haversine(S.prevPos, p);
  if (head != null && !isNaN(head) && S.speed > 3) S.heading = head;
  else if (moved > 6) S.heading = bearing(S.prevPos, p);
  if (moved > 6) S.prevPos = p;

  if (!S.pos) { player.addTo(map); map.setView(p, 17); }
  S.pos = p; S.lastFixT = Date.now();

  player.setLatLng(p);
  const arrow = document.getElementById('pArrow');
  if (arrow && S.heading != null) arrow.style.transform = `rotate(${S.heading}deg)`;
  if (S.follow) map.panTo(p, { animate: true, duration: 0.5 });

  updateSpeedo();
  checkRadars();
  if (S.route) updateNavigation();
}

/* ═════════════ VELOCÍMETRO ═════════════ */
// O arco ocupa 270° de uma circunferência de raio 50 → comprimento total = 2π·50 ≈ 314,2
// 270° = 3/4 disso ≈ 235,6.  Preenchemos proporcional à velocidade (escala 0–160 km/h).
function updateSpeedo(limit) {
  const v = Math.round(S.speed);
  $('spVal').textContent = v;
  const frac = Math.min(v / 160, 1);
  $('spArc').style.strokeDasharray = `${(235.6 * frac).toFixed(1)} 314.2`;
  const lim = limit ?? S.activeAlert?.limit;
  $('speedo').classList.toggle('over', !!lim && v > lim);
  $('spLimit').classList.toggle('hidden', !lim);
  if (lim) $('spLimit').textContent = lim;
}

/* ═════════════ RADARES (OpenStreetMap via Overpass) ═════════════ */
async function loadRadars(force) {
  const cache = load('nc_radars', null);
  if (!force && cache && Date.now() - cache.t < CFG.radarCacheHours * 3600e3) {
    S.radars = cache.list; renderRadars(); return;
  }
  toast('BAIXANDO RADARES DO OPENSTREETMAP...');
  const [s, w, n, e] = CFG.bbox, bb = `${s},${w},${n},${e}`;
  // Pegamos: câmeras de velocidade (nós) e relações de "fiscalização" (enforcement)
  const q = `[out:json][timeout:30];
    (node["highway"="speed_camera"](${bb});
     node["enforcement"="maxspeed"](${bb});
     relation["type"="enforcement"](${bb}););
    out body; >; out skel qt;`;
  for (const url of CFG.overpass) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      S.radars = parseOverpass(j.elements);
      save('nc_radars', { t: Date.now(), list: S.radars });
      renderRadars();
      toast(`${S.radars.length} RADARES CARREGADOS`);
      return;
    } catch (err) { console.warn('overpass', url, err); }
  }
  if (cache) { S.radars = cache.list; renderRadars(); }
  toast('FALHA AO BAIXAR RADARES — usando cache');
}

function parseOverpass(els) {
  const nodes = {}, out = new Map();
  for (const e of els) if (e.type === 'node') nodes[e.id] = e;
  const lim = t => { const m = String(t?.maxspeed || '').match(/\d+/); return m ? +m[0] : null; };
  for (const e of els) {
    if (e.type === 'node' && e.tags && (e.tags.highway === 'speed_camera' || e.tags.enforcement))
      out.set(e.id, { id: 'osm' + e.id, lat: e.lat, lon: e.lon, limit: lim(e.tags), dir: e.tags.direction ?? null, src: 'osm' });
    if (e.type === 'relation' && e.members) {
      // numa relação de fiscalização, o membro "device" é a câmera em si
      const dev = e.members.find(m => m.role === 'device' && m.type === 'node') || e.members.find(m => m.type === 'node');
      const n = dev && nodes[dev.ref];
      if (n) {
        const prev = out.get(n.id);
        out.set(n.id, { id: 'osm' + n.id, lat: n.lat, lon: n.lon, limit: lim(e.tags) ?? prev?.limit ?? null, dir: prev?.dir ?? null, src: 'osm' });
      }
    }
  }
  return [...out.values()];
}

function mkIcon(cls, html) { return L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="mk ${cls}">${html}</div>` }); }

function renderRadars() {
  radarLayer.clearLayers();
  for (const r of S.radars)
    L.marker([r.lat, r.lon], { icon: mkIcon('radar', r.limit ?? '◉') })
      .bindPopup(`<b>RADAR (OSM)</b><br>Limite: ${r.limit ? r.limit + ' km/h' : 'não informado'}`).addTo(radarLayer);
  const userR = S.reports.filter(x => x.type === 'radar').length;
  $('radarCount').textContent = `RADARES: ${S.radars.length + userR}`;
}

/* lista unificada de tudo que gera alerta: radares OSM + seus reportes */
function alertables() {
  return [...S.radars.map(r => ({ ...r, type: 'radar' })), ...S.reports.filter(r => r.type !== 'route')];
}

/* ── O "radar.daemon": roda a cada atualização do GPS ── */
function checkRadars() {
  if (!S.pos) return;
  let best = null;
  for (const r of alertables()) {
    const d = haversine(S.pos, [r.lat, r.lon]);
    if (d > CFG.alertDist + 150) { if (S.alerted[r.id] && d > CFG.alertDist + 150) delete S.alerted[r.id]; continue; }
    if (d > CFG.alertDist) continue;
    // Está À FRENTE? compara o rumo até o radar com o rumo em que estou indo.
    if (S.heading != null && d > 40 && angleDiff(bearing(S.pos, [r.lat, r.lon]), S.heading) > CFG.aheadAngle) continue;
    // Se o radar tem "direction" no OSM (fiscaliza só um sentido), respeitamos.
    if (r.dir != null && !isNaN(+r.dir) && S.heading != null && angleDiff(+r.dir, S.heading) > 60) continue;
    if (!best || d < best.d) best = { ...r, d };
  }
  showAlert(best);
}

const LABEL = { radar: 'RADAR', police: 'POLÍCIA', accident: 'ACIDENTE', hazard: 'PERIGO' };
function showAlert(a) {
  S.activeAlert = a && a.type === 'radar' ? a : null;
  if (!a) { $('radarAlert').classList.add('hidden'); $('alertFrame').classList.remove('on'); updateSpeedo(); return; }
  const over = a.limit && S.speed > a.limit;
  $('radarAlert').classList.remove('hidden');
  $('raTitle').textContent = `${LABEL[a.type]} · ${Math.round(a.d / 10) * 10} m`;
  $('raSub').textContent = a.limit ? (over ? `⚠ REDUZA! LIMITE ${a.limit}` : `LIMITE ${a.limit} KM/H`) : 'ATENÇÃO À FRENTE';
  $('alertFrame').classList.toggle('on', !!over);
  updateSpeedo(a.limit);

  // Fala só uma vez por radar (e de novo se você estiver acima do limite perto dele)
  const st = S.alerted[a.id] || (S.alerted[a.id] = {});
  if (!st.first) {
    st.first = true; beep(a.type === 'radar' ? 1200 : 700, 120, 3); vibrate(400);
    speak(`${LABEL[a.type].toLowerCase()} em ${Math.round(a.d / 50) * 50} metros${a.limit ? ', limite ' + a.limit : ''}`);
  } else if (over && !st.over && a.d < 200) {
    st.over = true; beep(1500, 90, 5); vibrate(800); speak(`Reduza, limite ${a.limit}`);
  }
}

/* ═════════════ REPORTES (toque longo no mapa) ═════════════ */
let pendingLatLng = null;
function openReportMenu(latlng) { pendingLatLng = latlng; vibrate(40); $('reportMenu').classList.remove('hidden'); }
map.on('contextmenu', e => openReportMenu(e.latlng));
// Toque longo "na mão" (o Android nem sempre dispara contextmenu dentro do app)
(() => {
  const el = map.getContainer(); let timer = null, start = null;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { clearTimeout(timer); return; }
    const t = e.touches[0], rect = el.getBoundingClientRect();
    start = [t.clientX, t.clientY];
    timer = setTimeout(() => openReportMenu(map.containerPointToLatLng([t.clientX - rect.left, t.clientY - rect.top])), 650);
  }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; if (start && Math.hypot(t.clientX - start[0], t.clientY - start[1]) > 10) clearTimeout(timer); }, { passive: true });
  el.addEventListener('touchend', () => clearTimeout(timer));
})();

$('reportMenu').addEventListener('click', e => {
  const type = e.target.dataset?.type; if (!type) return;
  $('reportMenu').classList.add('hidden');
  if (type === 'close' || !pendingLatLng) return;
  const ll = pendingLatLng;
  if (type === 'route') return routeTo([ll.lat, ll.lng], 'Ponto no mapa');
  S.reports.push({ id: 'u' + Date.now(), type, lat: ll.lat, lon: ll.lng,
    limit: type === 'radar' ? +$('rmSpeed').value : null, t: Date.now() });
  save('nc_reports', S.reports); renderReports(); renderRadars();
  toast(`${LABEL[type]} MARCADO`);
});

const ICON_CH = { radar: '◉', police: '⛨', accident: '✸', hazard: '⚠' };
function renderReports() {
  reportLayer.clearLayers();
  for (const r of S.reports) {
    const ic = r.type === 'radar' ? mkIcon('radar user', r.limit ?? '◉') : mkIcon(r.type, ICON_CH[r.type]);
    const age = Math.round((Date.now() - r.t) / 3600e3);
    L.marker([r.lat, r.lon], { icon: ic }).bindPopup(
      `<b>${LABEL[r.type]} (SEU)</b><br>${r.limit ? 'Limite ' + r.limit + ' km/h<br>' : ''}<small>há ${age} h</small><br>
       <button class="cp-btn red" onclick="delReport('${r.id}')">REMOVER</button>`).addTo(reportLayer);
  }
}
window.delReport = id => { S.reports = S.reports.filter(r => r.id !== id); save('nc_reports', S.reports); renderReports(); renderRadars(); map.closePopup(); };

/* ═════════════ BUSCA DE ENDEREÇO (Nominatim) ═════════════ */
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(search, 700); }); // 700 ms: respeita o limite de 1 busca/s
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qTimer); search(); } });
$('qClear').onclick = () => { $('q').value = ''; $('results').classList.add('hidden'); };

async function search() {
  const q = $('q').value.trim(); if (q.length < 3) return $('results').classList.add('hidden');
  const [s, w, n, e] = CFG.bbox;
  const url = `${CFG.nominatim}?format=jsonv2&limit=7&countrycodes=br&accept-language=pt-BR&addressdetails=0` +
    `&viewbox=${w},${n},${e},${s}&bounded=0&q=${encodeURIComponent(q)}`;
  try {
    const list = await (await fetch(url)).json();
    // ordena: mais perto de mim (ou do centro de Hortolândia) primeiro
    const ref = S.pos || CFG.center;
    list.sort((a, b) => haversine(ref, [+a.lat, +a.lon]) - haversine(ref, [+b.lat, +b.lon]));
    const box = $('results'); box.innerHTML = '';
    if (!list.length) box.innerHTML = '<div class="res"><small>Nada encontrado</small></div>';
    for (const it of list) {
      const [title, ...rest] = it.display_name.split(',');
      const d = haversine(ref, [+it.lat, +it.lon]);
      const div = document.createElement('div'); div.className = 'res';
      div.innerHTML = `<b>${title}</b><small>${rest.slice(0, 3).join(',')} · ${(d / 1000).toFixed(1)} km</small>`;
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
    if (!S.navigating) map.fitBounds(routeLine.getBounds(), { padding: [70, 70] }); else setFollow(true);
  } catch (e) { toast('NÃO FOI POSSÍVEL CALCULAR A ROTA'); console.warn(e); }
}

function buildRoute(rt) {
  // OSRM devolve [lon, lat]; o Leaflet usa [lat, lon] → invertemos
  const coords = rt.geometry.coordinates.map(c => [c[1], c[0]]);
  // cum[i] = distância acumulada do início até o vértice i (soma corrida dos segmentos)
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const steps = rt.legs.flatMap(l => l.steps);
  // Para cada manobra, achamos o vértice da rota mais próximo → "a quantos metros do início ela fica"
  let k = 0;
  const stepAlong = steps.map(st => {
    const loc = [st.maneuver.location[1], st.maneuver.location[0]];
    let bi = k, bd = Infinity;
    for (let i = k; i < coords.length; i++) { const d = haversine(loc, coords[i]); if (d < bd) { bd = d; bi = i; } if (d > bd + 300) break; }
    k = bi; return cum[bi];
  });
  S.route = { coords, cum, total: cum[cum.length - 1], duration: rt.duration, steps, stepAlong, said: {} };
  S.segIdx = 0; S.along = 0; S.offCount = 0;

  if (routeGlow) map.removeLayer(routeGlow); if (routeLine) map.removeLayer(routeLine);
  routeGlow = L.polyline(coords, { color: '#00f0ff', weight: 14, opacity: 0.25 }).addTo(map);  // "brilho" neon
  routeLine = L.polyline(coords, { color: '#00f0ff', weight: 5, opacity: 1 }).addTo(map);
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker(S.dest.p, { icon: mkIcon('dest', '⬢') }).bindPopup(`<b>DESTINO</b><br>${S.dest.name}`).addTo(map);

  $('tripBar').classList.remove('hidden');
  $('bGo').classList.toggle('hidden', S.navigating);
  updateTrip();
  updateNavigation();
}

function updateTrip(remaining) {
  const r = S.route; if (!r) return;
  // ETA proporcional: se falta x% da distância, falta ~x% do tempo previsto pelo OSRM
  const rem = remaining ?? r.total - S.along;
  const secs = r.duration * (rem / r.total);
  $('tbEta').textContent = Math.max(1, Math.round(secs / 60));
  $('tbDist').textContent = (rem / 1000).toFixed(1);
  const arr = new Date(Date.now() + secs * 1000);
  $('tbArr').textContent = arr.toTimeString().slice(0, 5);
}

/* ── chamado a cada posição nova durante a rota ── */
function updateNavigation() {
  const r = S.route; if (!r || !S.pos) return;
  // 1) Onde estou NA rota? procura o segmento mais próximo numa janela à frente (mais rápido que varrer tudo)
  let best = { d: Infinity, i: S.segIdx, t: 0 };
  const from = Math.max(0, S.segIdx - 5), to = Math.min(r.coords.length - 1, S.segIdx + 80);
  for (let i = from; i < to; i++) {
    const s = distToSegment(S.pos, r.coords[i], r.coords[i + 1]);
    if (s.d < best.d) best = { d: s.d, i, t: s.t };
  }
  S.segIdx = best.i;
  // distância percorrida ao longo da rota = acumulado até o vértice + fração t do segmento atual
  S.along = r.cum[best.i] + best.t * (r.cum[best.i + 1] - r.cum[best.i]);
  updateTrip();

  // 2) Saiu da rota? (3 leituras seguidas longe → recalcula, no máx. a cada 15 s)
  if (best.d > CFG.offRouteDist + (S.acc || 0) * 0.5) S.offCount++; else S.offCount = 0;
  if (S.navigating && S.offCount >= 3 && Date.now() - S.lastReroute > 15000) {
    S.lastReroute = Date.now(); S.offCount = 0;
    speak('Recalculando rota'); toast('RECALCULANDO...'); routeTo(S.dest.p, S.dest.name); return;
  }

  // 3) Chegou?
  if (haversine(S.pos, S.dest.p) < 30) { speak('Você chegou ao destino'); toast('DESTINO ALCANÇADO'); cancelRoute(); return; }

  // 4) Próxima manobra = primeira cuja posição na rota está à frente de mim
  let k = r.stepAlong.findIndex((a, i) => i > 0 && a > S.along + 5);
  if (k < 0) k = r.steps.length - 1;
  const step = r.steps[k], dist = r.stepAlong[k] - S.along;
  $('maneuver').classList.toggle('hidden', !S.navigating);
  $('mArrow').textContent = arrowFor(step);
  $('mDist').textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 10) * 10 + ' m';
  $('mInstr').textContent = instr(step);

  // 5) Voz: avisa a ~500 m, ~150 m e "agora" (a ~30 m)
  if (!S.navigating) return;
  const said = r.said[k] || (r.said[k] = {});
  if (dist < 500 && dist > 250 && !said.far) { said.far = true; speak(`Em ${Math.round(dist / 100) * 100} metros, ${instr(step)}`); }
  else if (dist < 150 && dist > 50 && !said.near) { said.near = true; speak(`Em ${Math.round(dist / 10) * 10} metros, ${instr(step)}`); }
  else if (dist <= 35 && !said.now) { said.now = true; speak(instr(step)); beep(990, 60, 1); }
}

/* ── tradução das manobras do OSRM para português ── */
const DIR = { left: 'à esquerda', right: 'à direita', 'slight left': 'levemente à esquerda', 'slight right': 'levemente à direita',
  'sharp left': 'acentuadamente à esquerda', 'sharp right': 'acentuadamente à direita', straight: 'em frente', uturn: 'fazendo o retorno' };
function onName(n) { if (!n) return ''; return (/^(viaduto|acesso|anel|contorno|trevo|complexo)/i.test(n) ? ' no ' : ' na ') + n; }
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
  S.route = null; S.navigating = false; S.dest = null;
  [routeGlow, routeLine, destMarker].forEach(l => l && map.removeLayer(l));
  $('tripBar').classList.add('hidden'); $('maneuver').classList.add('hidden');
}

/* ═════════════ BOTÕES ═════════════ */
function setFollow(on) { S.follow = on; $('bFollow').classList.toggle('active', on); if (on && S.pos) map.setView(S.pos, Math.max(map.getZoom(), 17)); }
$('bFollow').onclick = () => setFollow(!S.follow);
$('bRadar').onclick = () => loadRadars(true);
$('bTheme').onclick = () => { document.body.classList.toggle('theme-arasaka'); document.body.classList.toggle('theme-netrunner'); save('nc_theme', document.body.className); };
$('bMute').onclick = () => { S.muted = !S.muted; $('bMute').textContent = S.muted ? '🔇' : '🔊'; };
$('bGo').onclick = () => { S.navigating = true; $('bGo').classList.add('hidden'); setFollow(true); speak('Rota iniciada. ' + instr(S.route.steps[0])); updateNavigation(); };
$('bCancel').onclick = cancelRoute;
{ const th = load('nc_theme', null); if (th) document.body.className = th; }
