// ════════════════════════════════════════════════════════════════════
// Gera app/src/main/assets/radars.json com as posições dos radares de Hortolândia.
// Roda no GitHub Actions (tem internet); o app só lê o resultado pronto.
//
// ETAPA 1 (obrigatória, rápida): Nominatim — busca cada rua pelo nome e recebe o DESENHO dela.
//   • cross → calcula onde as duas ruas se cruzam (interseção de segmentos)
//   • near  → acha o lugar de referência e "gruda" no ponto mais próximo da rua
//   • só street → ponto exato desconhecido: vira "zona" (o app avisa ao entrar na via)
// ETAPA 2 (opcional): Overpass — semáforos e câmeras já cadastradas no OSM.
//   Esse servidor costuma ficar lento; se falhar, os radares da etapa 1 já estão salvos.
// ════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';

const UA = 'NightCityNav-radar-builder/1.1 (+https://github.com/henryzinholira-hub/77-nav)';
const BBOX = [-22.93, -47.31, -22.79, -47.12];          // sul, oeste, norte, leste
const OUT = 'app/src/main/assets/radars.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now(), report = [];
const log = m => { console.log(m); report.push(m); };

// q = como buscar a rua no Nominatim ; m = padrão para conferir o nome ("~" = qualquer letra)
const ST = {
  olivio:    { q: ['Avenida Olívio Franceschini'], m: 'Ol~vio Franceschini' },
  joaomendes:{ q: ['Rua João Mendes'], m: 'Jo~o Mendes' },
  flamboyant:{ q: ['Rua Flamboyant'], m: 'Flamboyant' },
  sabina:    { q: ['Avenida Sabina Baptista de Camargo', 'Estrada Municipal Sabina Batista de Camargo', 'Sabina Batista de Camargo'], m: 'Sabina' },
  prataviera:{ q: ['Estrada Municipal Carlos Roberto Prataviera', 'Carlos Roberto Prataviera', 'Prataviera', 'Pratavieira'], m: 'Prat\\p{L}vi\\p{L}?e?i?ra|Prataviera' },
  lira:      { q: ['Rua José Pereira de Lira'], m: 'Pereira de Lira' },
  panaino:   { q: ['Avenida Panaíno', 'Rua Panaíno', 'Panaino'], m: 'Pana~no' },
  corredor:  { q: ['Corredor Metropolitano Biléo Soares', 'Corredor Metropolitano', 'Biléo Soares'], m: 'Corredor|Bil~o Soares' },
  emancip:   { q: ['Avenida da Emancipação'], m: 'Emancipa~~o' },
  nelson:    { q: ['Rua Nelson Pereira Bueno'], m: 'Nelson Pereira Bueno' },
  santana:   { q: ['Avenida Santana'], m: '^(Avenida|Av\\.?) Santana$' },
  francisco: { q: ['Avenida São Francisco de Assis'], m: 'S~o Francisco de Assis' },
  cecon:     { q: ['Avenida Thereza Ana Cecon Breda'], m: 'Cecon Breda' },
  brasil:    { q: ['Avenida Brasil'], m: '^(Avenida|Av\\.?) Brasil$' },
  anjos:     { q: ['Rua Augusto dos Anjos'], m: 'Augusto dos Anjos' },
  camilo:    { q: ['Rua Luiz Camilo de Camargo', 'Rua Luís Camilo de Camargo'], m: 'Lu~z Camilo de Camargo' },
  otaviano:  { q: ['Rua Otaviano de Figueiredo Breda', 'Otaviano Breda', 'Otaviano de Figueiredo'], m: 'Otaviano' },
  superv:    { q: ['Superviário', 'Avenida Superviário', 'Superviario'], m: 'Supervi~rio' },
};
const SEED = [
  { id: 'p1', label: 'Av. Olívio Franceschini × R. João Mendes', street: 'olivio', cross: 'joaomendes', limit: 60, src: 'Prefeitura, out/2025' },
  { id: 'p2', label: 'R. Flamboyant × Av. Sabina B. de Camargo', street: 'flamboyant', cross: 'sabina', limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, out/2025' },
  { id: 'p3', label: 'Av. Sabina × Estr. Prataviera (rotatória do Paço)', street: 'sabina', cross: 'prataviera', limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, mar/2025' },
  { id: 'p4', label: 'R. José Pereira de Lira (acesso P.I. Panaíno)', street: 'lira', cross: 'panaino', limit: 40, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p5', label: 'Corredor Metropolitano (frente ao Paço Municipal)', street: 'corredor', near: ['Paço Municipal de Hortolândia', 'Prefeitura Municipal de Hortolândia', 'Prefeitura de Hortolândia'], limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p6', label: 'Av. da Emancipação (perto da Wickbold)', street: 'emancip', near: ['Wickbold Hortolândia', 'Wickbold'], limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, ago/2025' },
  { id: 'p7', label: 'Av. da Emancipação (perto da Magneti Marelli)', street: 'emancip', near: ['Magneti Marelli Hortolândia', 'Marelli'], limit: 60, dir: 'bairro → Centro', src: 'Prefeitura, ago/2025' },
  { id: 'p8', label: 'Av. da Emancipação (Hospital Mário Covas)', street: 'emancip', near: ['Hospital Municipal Mário Covas Hortolândia', 'Hospital Mário Covas'], limit: 50, src: 'lista de 2019' },
  { id: 'p9', label: 'Estr. Carlos R. Prataviera (frente ao cemitério)', street: 'prataviera', near: ['Cemitério Municipal de Hortolândia', 'Cemitério Hortolândia'], limit: 50, src: 'lista de 2019' },
  { id: 'z1', label: 'R. Nelson Pereira Bueno', street: 'nelson', limit: 50, src: 'lista de 2019' },
  { id: 'z2', label: 'Av. Santana (Jd. Amanda)', street: 'santana', limit: 50, src: 'lista de 2019' },
  { id: 'z3', label: 'Av. São Francisco de Assis', street: 'francisco', limit: 50, src: 'lista de 2019' },
  { id: 'z4', label: 'Av. Thereza Ana Cecon Breda', street: 'cecon', limit: 50, src: 'lista de 2019' },
  { id: 'z5', label: 'Av. Brasil (Jd. Amanda)', street: 'brasil', limit: 50, src: 'lista de 2019' },
  { id: 'z6', label: 'R. Augusto dos Anjos', street: 'anjos', limit: 50, src: 'lista de 2019' },
  { id: 'z7', label: 'R. Luiz Camilo de Camargo', street: 'camilo', limit: 50, src: 'lista de 2019' },
  { id: 'z8', label: 'R. Otaviano de Figueiredo Breda', street: 'otaviano', limit: 50, src: 'lista de 2019' },
  { id: 'z9', label: 'Superviário', street: 'superv', limit: 50, src: 'Prefeitura, jun/2026' },
];
const rx = p => new RegExp(p.replace(/~/g, '\\p{L}'), 'iu');

// ── geometria ──
const R = 6371000, toRad = d => d * Math.PI / 180;
const proj = (p, ref) => [toRad(p[1] - ref[1]) * Math.cos(toRad(ref[0])) * R, toRad(p[0] - ref[0]) * R];
function seg(p, a, b) { const A = proj(a, p), B = proj(b, p), x = B[0] - A[0], y = B[1] - A[1], l = x * x + y * y; let t = l ? -(A[0] * x + A[1] * y) / l : 0; t = Math.max(0, Math.min(1, t)); return { d: Math.hypot(A[0] + t * x, A[1] + t * y), t }; }
function nearest(p, lines) { let best = { d: Infinity, pt: null }; for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) { const s = seg(p, ln[i], ln[i + 1]); if (s.d < best.d) best = { d: s.d, pt: [ln[i][0] + s.t * (ln[i + 1][0] - ln[i][0]), ln[i][1] + s.t * (ln[i + 1][1] - ln[i][1])] }; } return best; }
/* Interseção de dois segmentos AB e CD (no plano local, em metros, com A na origem):
   resolve t·B = C + u·(D−C) ; se 0 ≤ t ≤ 1 e 0 ≤ u ≤ 1, eles se cruzam. */
function segX(a, b, c, d) {
  const B = proj(b, a), C = proj(c, a), D = proj(d, a);
  const den = B[0] * (D[1] - C[1]) - B[1] * (D[0] - C[0]); if (Math.abs(den) < 1e-9) return null;
  const t = (C[0] * (D[1] - C[1]) - C[1] * (D[0] - C[0])) / den, u = (C[0] * B[1] - C[1] * B[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] : null;
}
function crossing(LA, LB) {
  for (const la of LA) for (let i = 0; i < la.length - 1; i++) for (const lb of LB) for (let j = 0; j < lb.length - 1; j++) {
    const x = segX(la[i], la[i + 1], lb[j], lb[j + 1]); if (x) return { pt: x, d: 0 };
  }
  let best = { d: Infinity, pt: null };          // não se cruzam (viaduto, fim de rua): par de pontos mais próximo
  for (const la of LA) for (const p of la) { const nb = nearest(p, LB); if (nb.d < best.d) best = { d: nb.d, pt: p }; }
  return best.d < 120 ? best : null;
}
const r6 = x => Math.round(x * 1e6) / 1e6;

// ── Nominatim (1 busca por segundo, como pede a regra de uso) ──
async function nomi(q, extra = '') {
  const [s, w, n, e] = BBOX;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&viewbox=${w},${n},${e},${s}&bounded=1&q=${encodeURIComponent(q)}${extra}`;
  for (let tent = 1; tent <= 3; tent++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(25000) });
      await sleep(1200);
      if (r.ok) return await r.json();
      console.log(`[nominatim] "${q}" HTTP ${r.status}`);
    } catch (err) { console.log(`[nominatim] "${q}" erro ${err.message}`); await sleep(2000); }
  }
  return [];
}
const geomCache = {};
async function streetLines(key) {
  if (geomCache[key]) return geomCache[key];
  const st = ST[key], lines = [], names = new Set();
  for (const q of st.q) {
    const res = await nomi(`${q}, Hortolândia`, '&polygon_geojson=1&limit=40&dedupe=0');
    for (const it of res) {
      const nm = it.name || it.display_name.split(',')[0];
      if (it.category !== 'highway' && it.class !== 'highway') continue;
      if (!rx(st.m).test(nm)) continue;
      const g = it.geojson; if (!g) continue;
      const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const c of parts) lines.push(c.map(([lon, lat]) => [lat, lon]));
      names.add(nm);
    }
  }
  console.log(`[rua] ${key}: ${lines.length} trechos (${[...names].join(' / ') || 'nada'})`);
  return (geomCache[key] = { lines, names: [...names] });
}

const radars = [], zones = [], missing = [];
let signals = [];
function save() {
  writeFileSync(OUT, JSON.stringify({ v: 3, generated: new Date().toISOString(), radars, zones, signals, missing, report }));
}

// ═════ ETAPA 1: radares da prefeitura ═════
for (const sd of SEED) {
  const A = await streetLines(sd.street);
  if (!A.lines.length && sd.near) {
    // rua não achada pelo nome: acha o lugar de referência e pega a VIA MAIS PRÓXIMA dele (busca reversa)
    let done = false;
    for (const q of sd.near) {
      const r = await nomi(q, '&limit=1'); if (!r[0]) continue;
      const [s_, w_, n_, e_] = BBOX;
      let rev = null;
      try { const rr = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&layer=address&polygon_geojson=1&lat=${r[0].lat}&lon=${r[0].lon}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) }); await sleep(1200); rev = rr.ok ? await rr.json() : null; } catch {}
      const g = rev?.geojson, ref = [+r[0].lat, +r[0].lon];
      const lines = g?.type === 'LineString' ? [g.coordinates.map(([a, b]) => [b, a])] : g?.type === 'MultiLineString' ? g.coordinates.map(c => c.map(([a, b]) => [b, a])) : [];
      const nb = lines.length ? nearest(ref, lines) : { pt: ref, d: 0 };
      radars.push({ id: sd.id, lat: r6(nb.pt[0]), lon: r6(nb.pt[1]), limit: sd.limit, label: sd.label, dir: sd.dir || null, src: sd.src, how: `aproximado: ${rev?.name || 'via'} em frente a ${r[0].name || q}`, origin: 'pref', approx: true });
      log(`≈ ${sd.id} ${sd.label} → ${r6(nb.pt[0])},${r6(nb.pt[1])} (via mais próxima de ${r[0].display_name}: ${rev?.name || '?'})`);
      done = true; break;
    }
    if (done) continue;
  }
  if (!A.lines.length) { missing.push(sd.label); log(`✗ ${sd.id} ${sd.label}: rua não encontrada`); continue; }
  let res = null, how = '';
  if (sd.cross) {
    const B = await streetLines(sd.cross);
    res = B.lines.length ? crossing(A.lines, B.lines) : null;
    how = res ? (res.d ? `cruzamento aproximado (${Math.round(res.d)} m)` : 'cruzamento das ruas') : '';
    if (!res) log(`  ${sd.id}: ${A.names.join('/')} × ${B.names.join('/') || '(não achada)'} sem cruzamento`);
  } else if (sd.near) {
    for (const q of sd.near) {
      const r = await nomi(q, '&limit=1'); if (!r[0]) { console.log(`[ref] "${q}" não achado`); continue; }
      const p = [+r[0].lat, +r[0].lon], nb = nearest(p, A.lines);
      console.log(`[ref] "${q}" → ${r[0].display_name} (a ${Math.round(nb.d)} m da rua)`);
      if (nb.d < 300) { res = nb; how = `em frente a ${r[0].name || q} (${Math.round(nb.d)} m)`; break; }
    }
  }
  if (res) { radars.push({ id: sd.id, lat: r6(res.pt[0]), lon: r6(res.pt[1]), limit: sd.limit, label: sd.label, dir: sd.dir || null, src: sd.src, how, origin: 'pref' }); log(`✓ ${sd.id} ${sd.label} → ${r6(res.pt[0])},${r6(res.pt[1])} (${how})`); }
  else {
    zones.push({ id: sd.id, label: sd.label, limit: sd.limit, src: sd.src, lines: A.lines.map(l => l.map(p => [r6(p[0]), r6(p[1])])) });
    log(`~ ${sd.id} ${sd.label}: zona (${A.names.join('/')}, ${A.lines.length} trechos)`);
  }
}
save();
log(`etapa 1 ok em ${Math.round((Date.now() - T0) / 1000)} s: ${radars.length} pontos, ${zones.length} zonas`);

// ═════ ETAPA 2 (opcional): semáforos e câmeras do OSM via Overpass ═════
async function overpass(q, label) {
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      console.log(`[overpass] ${label} ${url}: HTTP ${r.status} em ${Date.now() - t0} ms`);
      if (r.ok) return (await r.json()).elements;
    } catch (e) { console.log(`[overpass] ${label} ${url}: ${e.message} após ${Date.now() - t0} ms`); }
  }
  throw new Error('todos os servidores Overpass falharam');
}
try {
  const [s, w, n, e] = BBOX, bb = `${s},${w},${n},${e}`;
  const els = await overpass(`[out:json][timeout:50];(node["highway"="traffic_signals"](-22.89,-47.27,-22.82,-47.16);node["highway"="speed_camera"](${bb});node["enforcement"](${bb}););out body;`, 'semaforos+cameras');
  signals = els.filter(x => x.tags?.highway === 'traffic_signals').map(x => [r6(x.lat), r6(x.lon)]);
  const lim = t => { const m = String(t?.maxspeed || '').match(/\d+/); return m ? +m[0] : null; };
  for (const x of els) if (x.tags?.highway === 'speed_camera' || x.tags?.enforcement)
    radars.push({ id: 'osm' + x.id, lat: r6(x.lat), lon: r6(x.lon), limit: lim(x.tags), osmDir: x.tags.direction ?? null, label: x.tags.name || 'Câmera cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
  log(`etapa 2 ok: ${signals.length} semáforos, ${els.length - signals.length} câmeras do OSM`);
} catch (e) { log('etapa 2 falhou (radares da etapa 1 continuam salvos): ' + e.message); }
log(`tempo total: ${Math.round((Date.now() - T0) / 1000)} s`);
save();
console.log(`\nTOTAL: ${radars.length} radares, ${zones.length} vias-zona, ${signals.length} semáforos`);
