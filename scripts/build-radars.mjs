// ════════════════════════════════════════════════════════════════════
// Gera app/src/main/assets/radars.json com as posições dos radares de Hortolândia.
// Roda no GitHub Actions (tem internet) — o app só lê o resultado pronto.
//
// Como acha cada radar publicado pela prefeitura (as notícias não dão coordenadas):
//   • cross → ponto onde as duas ruas se cruzam no desenho do OpenStreetMap
//   • near  → acha o lugar de referência (Nominatim) e "gruda" no ponto mais próximo da rua
//   • só street → ponto exato desconhecido: vira "zona" (avisa ao entrar na via)
// Também baixa câmeras já cadastradas no OSM e todos os semáforos da cidade.
// ════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';

const UA = 'NightCityNav-radar-builder/1.0 (+https://github.com/henryzinholira-hub/77-nav)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const BBOX = [-22.93, -47.31, -22.79, -47.12];          // sul, oeste, norte, leste
const sleep = ms => new Promise(r => setTimeout(r, ms));

// "~" no padrão = qualquer letra (com ou sem acento). Comparação feita aqui em JS (Unicode correto).
const SEED = [
  { id: 'p1', label: 'Av. Olívio Franceschini × R. João Mendes', street: 'Ol~vio Franceschini', cross: 'Jo~o Mendes', limit: 60, src: 'Prefeitura, out/2025' },
  { id: 'p2', label: 'R. Flamboyant × Av. Sabina B. de Camargo', street: 'Flamboyant', cross: 'Sabina', limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, out/2025' },
  { id: 'p3', label: 'Av. Sabina B. de Camargo × Estr. Prataviera', street: 'Sabina', cross: 'Prataviera', limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, mar/2025' },
  { id: 'p4', label: 'R. José Pereira de Lira (acesso P.I. Panaíno)', street: 'Pereira de Lira', cross: 'Pana~no', limit: 40, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p5', label: 'Corredor Metropolitano (frente ao Paço)', street: 'Corredor|Bil~o Soares', near: ['Prefeitura Municipal de Hortolândia', 'Paço Municipal Hortolândia'], limit: 50, dir: 'bairro → Centro', src: 'Prefeitura, out/2025' },
  { id: 'p6', label: 'Av. da Emancipação (perto da Wickbold)', street: 'Emancipa~~o', near: ['Wickbold Hortolândia', 'Wickbold'], limit: 50, dir: 'Centro → bairro', src: 'Prefeitura, ago/2025' },
  { id: 'p7', label: 'Av. da Emancipação (perto da Magneti Marelli)', street: 'Emancipa~~o', near: ['Magneti Marelli Hortolândia', 'Marelli Hortolândia'], limit: 60, dir: 'bairro → Centro', src: 'Prefeitura, ago/2025' },
  { id: 'p8', label: 'Av. da Emancipação (Hospital Mário Covas)', street: 'Emancipa~~o', near: ['Hospital Municipal Mário Covas Hortolândia', 'Hospital Mário Covas Hortolândia'], limit: 50, src: 'lista de 2019' },
  { id: 'p9', label: 'Estr. Carlos R. Prataviera (frente ao cemitério)', street: 'Prataviera', near: ['Cemitério Municipal Hortolândia', 'Cemitério Hortolândia'], limit: 50, src: 'lista de 2019' },
  { id: 'z1', label: 'R. Nelson Pereira Bueno', street: 'Nelson Pereira Bueno', limit: 50, src: 'lista de 2019' },
  { id: 'z2', label: 'Av. Santana (Jd. Amanda)', street: '^(Avenida|Av\\.?) Santana$', limit: 50, src: 'lista de 2019' },
  { id: 'z3', label: 'Av. São Francisco de Assis', street: 'S~o Francisco de Assis', limit: 50, src: 'lista de 2019' },
  { id: 'z4', label: 'Av. Thereza Ana Cecon Breda', street: 'Cecon Breda', limit: 50, src: 'lista de 2019' },
  { id: 'z5', label: 'Av. Brasil (Jd. Amanda)', street: '^(Avenida|Av\\.?) Brasil$', limit: 50, src: 'lista de 2019' },
  { id: 'z6', label: 'R. Augusto dos Anjos', street: 'Augusto dos Anjos', limit: 50, src: 'lista de 2019' },
  { id: 'z7', label: 'R. Luiz Camilo de Camargo', street: 'Lu~z Camilo de Camargo', limit: 50, src: 'lista de 2019' },
  { id: 'z8', label: 'R. Otaviano de Figueiredo Breda', street: 'Otaviano de Figueiredo Breda', limit: 50, src: 'lista de 2019' },
  { id: 'z9', label: 'Superviário', street: 'Supervi~rio', limit: 50, src: 'Prefeitura, jun/2026' },
];
const rx = p => new RegExp(p.replace(/~/g, '\\p{L}'), 'iu');

// ── geometria (mesma do app) ──
const R = 6371000, toRad = d => d * Math.PI / 180;
const hav = (a, b) => { const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
const proj = (p, ref) => [toRad(p[1] - ref[1]) * Math.cos(toRad(ref[0])) * R, toRad(p[0] - ref[0]) * R];
function seg(p, a, b) { const A = proj(a, p), B = proj(b, p), x = B[0] - A[0], y = B[1] - A[1], l = x * x + y * y; let t = l ? -(A[0] * x + A[1] * y) / l : 0; t = Math.max(0, Math.min(1, t)); return { d: Math.hypot(A[0] + t * x, A[1] + t * y), t }; }
function nearest(p, lines) { let best = { d: Infinity, pt: null }; for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) { const s = seg(p, ln[i], ln[i + 1]); if (s.d < best.d) best = { d: s.d, pt: [ln[i][0] + s.t * (ln[i + 1][0] - ln[i][0]), ln[i][1] + s.t * (ln[i + 1][1] - ln[i][1])] }; } return best; }
const r6 = x => Math.round(x * 1e6) / 1e6;

async function overpass(q, label) {
  for (const url of OVERPASS) for (let tent = 1; tent <= 2; tent++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
      const txt = await r.text();
      console.log(`[overpass] ${label} ${url} tentativa ${tent}: HTTP ${r.status} em ${Date.now() - t0} ms, ${txt.length} bytes`);
      if (r.ok) return JSON.parse(txt).elements;
    } catch (e) { console.log(`[overpass] ${label} ${url}: erro ${e.message}`); }
    await sleep(4000);
  }
  throw new Error('overpass falhou: ' + label);
}
async function nominatim(q) {
  const [s, w, n, e] = BBOX;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&viewbox=${w},${n},${e},${s}&bounded=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  await sleep(1200);                                       // regra do Nominatim: 1 busca por segundo
  if (!r.ok) { console.log(`[nominatim] "${q}" HTTP ${r.status}`); return null; }
  const j = await r.json(); console.log(`[nominatim] "${q}" → ${j[0] ? j[0].display_name : 'nada'}`);
  return j[0] ? [+j[0].lat, +j[0].lon] : null;
}

// 1) diagnóstico: a MESMA consulta que o app v3 fazia no celular (para descobrir por que falhava)
const report = [];
{
  const pats = ['Ol.vio Franceschini', 'Jo.o Mendes', 'Sabina', 'Emancipa..o'];
  const q = `[out:json][timeout:90];area["name"="Hortolândia"]["admin_level"="8"]->.h;way(area.h)["highway"]["name"~"${pats.map(p => `(${p})`).join('|')}",i];out tags;`;
  try { const els = await overpass(q, 'diagnóstico-regex-do-app'); const names = [...new Set(els.map(e => e.tags?.name))]; report.push(`diag: consulta antiga achou ${names.length} nomes: ${names.join(' | ')}`); }
  catch (e) { report.push('diag: consulta antiga FALHOU: ' + e.message); }
}

// 2) todas as ruas com nome da cidade (comparação de nomes feita aqui, com acento correto)
const [s, w, n, e] = BBOX, bb = `${s},${w},${n},${e}`;
const streets = await overpass(`[out:json][timeout:180];area["name"="Hortolândia"]["admin_level"="8"]->.h;way(area.h)["highway"]["name"];out body geom;`, 'ruas');
const ways = streets.filter(x => x.type === 'way' && x.geometry).map(x => ({ name: x.tags.name, hw: x.tags.highway, nodes: x.nodes, geom: x.geometry.map(g => [g.lat, g.lon]) }));
report.push(`ruas com nome na cidade: ${ways.length}`);

// 3) semáforos + câmeras já cadastradas no OSM
const extra = await overpass(`[out:json][timeout:120];area["name"="Hortolândia"]["admin_level"="8"]->.h;
  node(area.h)["highway"="traffic_signals"]; out body;
  (node["highway"="speed_camera"](${bb}); node["enforcement"](${bb}); relation["type"="enforcement"](${bb}););
  out body; >; out skel qt;`, 'semaforos+cameras');
const signals = extra.filter(x => x.type === 'node' && x.tags?.highway === 'traffic_signals').map(x => [r6(x.lat), r6(x.lon)]);
const nodes = Object.fromEntries(extra.filter(x => x.type === 'node').map(x => [x.id, x]));
const lim = t => { const m = String(t?.maxspeed || '').match(/\d+/); return m ? +m[0] : null; };
const osm = new Map();
for (const x of extra) {
  if (x.type === 'node' && (x.tags?.highway === 'speed_camera' || x.tags?.enforcement))
    osm.set(x.id, { id: 'osm' + x.id, lat: r6(x.lat), lon: r6(x.lon), limit: lim(x.tags), osmDir: x.tags.direction ?? null, label: x.tags.name || 'Câmera cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
  if (x.type === 'relation' && x.members) {
    const dev = x.members.find(m => m.role === 'device' && m.type === 'node') || x.members.find(m => m.type === 'node');
    const nd = dev && nodes[dev.ref];
    if (nd) osm.set(nd.id, { id: 'osm' + nd.id, lat: r6(nd.lat), lon: r6(nd.lon), limit: lim(x.tags) ?? osm.get(nd.id)?.limit ?? null, osmDir: null, label: x.tags?.name || 'Fiscalização cadastrada no OSM', src: 'OpenStreetMap', origin: 'osm' });
  }
}
report.push(`semáforos: ${signals.length} · câmeras no OSM (região): ${osm.size}`);

// 4) resolve cada radar da prefeitura
function intersect(A, B) {
  for (const a of A) { const ids = new Map(a.nodes.map((id, i) => [id, a.geom[i]])); for (const b of B) for (const id of b.nodes) if (ids.has(id)) return { pt: ids.get(id), d: 0 }; }
  let best = { d: Infinity, pt: null };
  for (const a of A) for (const p of a.geom) { const nb = nearest(p, B.map(b => b.geom)); if (nb.d < best.d) best = { d: nb.d, pt: p }; }
  return best.d < 120 ? best : null;
}
const radars = [...osm.values()], zones = [], missing = [];
for (const sd of SEED) {
  const A = ways.filter(x => rx(sd.street).test(x.name));
  const names = [...new Set(A.map(a => a.name))];
  if (!A.length) { missing.push(sd.label); report.push(`✗ ${sd.id} ${sd.label}: rua não encontrada`); continue; }
  let res = null, how = '';
  if (sd.cross) {
    const B = ways.filter(x => rx(sd.cross).test(x.name));
    res = B.length ? intersect(A, B) : null; how = res ? (res.d ? `cruzamento aproximado (${Math.round(res.d)} m)` : 'cruzamento') : '';
    if (!res) report.push(`  ${sd.id}: ruas ${names.join('/')} × ${[...new Set(B.map(b => b.name))].join('/') || '(cruzada não achada)'} não se cruzam`);
  } else if (sd.near) {
    for (const q of sd.near) { const p = await nominatim(q); if (!p) continue; const nb = nearest(p, A.map(a => a.geom)); if (nb.d < 700) { res = nb; how = `perto de ${q.replace(/ Hortolândia$/, '')} (${Math.round(nb.d)} m da referência)`; break; } }
  }
  if (res) { radars.push({ id: sd.id, lat: r6(res.pt[0]), lon: r6(res.pt[1]), limit: sd.limit, label: sd.label, dir: sd.dir || null, src: sd.src, how, origin: 'pref' }); report.push(`✓ ${sd.id} ${sd.label} → ${r6(res.pt[0])},${r6(res.pt[1])} (${how})`); }
  else {
    // zona: guarda a geometria simplificada da via (1 ponto a cada ~25 m) para o app avisar ao entrar nela
    const lines = A.map(a => a.geom.filter((p, i, g) => i === 0 || i === g.length - 1 || i % 2 === 0).map(p => [r6(p[0]), r6(p[1])]));
    zones.push({ id: sd.id, label: sd.label, limit: sd.limit, src: sd.src, lines });
    report.push(`~ ${sd.id} ${sd.label}: zona (${names.join('/')}, ${A.length} trechos)`);
  }
}
const out = { v: 3, generated: new Date().toISOString(), radars, zones, signals, missing, report };
writeFileSync('app/src/main/assets/radars.json', JSON.stringify(out));
console.log(report.join('\n'));
console.log(`\nTOTAL: ${radars.length} radares (pontos), ${zones.length} vias-zona, ${signals.length} semáforos`);
