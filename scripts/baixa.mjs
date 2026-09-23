// Baixa els vídeos nous dels canals (RSS) i en desa la transcripció a pendents/<id>.json.
// Ús: node scripts/baixa.mjs [dies=7]
// Finestra àmplia a propòsit: si un dia la tasca no s'executa (PC apagat), l'endemà recupera
// els vídeos perduts. Els ja resumits (dades/resums.json) no es tornen a baixar.
import fs from 'node:fs';
import path from 'node:path';

const ARREL = path.resolve(import.meta.dirname, '..');
const DIES = Number(process.argv[2] || 7);
const DURADA_MIN = 180; // segons: descarta els shorts

const canals = JSON.parse(fs.readFileSync(path.join(ARREL, 'canals.json'), 'utf8'));
const fitxerResums = path.join(ARREL, 'dades', 'resums.json');
const fets = new Set(fs.existsSync(fitxerResums)
  ? JSON.parse(fs.readFileSync(fitxerResums, 'utf8')).videos.map(v => v.id) : []);
const dirPendents = path.join(ARREL, 'pendents');
fs.mkdirSync(dirPendents, { recursive: true });

const entitats = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n));

async function llegeixFeed(canal) {
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`)).text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)[1],
    titol: entitats(e.match(/<media:title>([^<]*)/)[1]),
    data: e.match(/<published>([^<]+)/)[1],
    descripcio: entitats(e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || ''),
  }));
}

async function transcripcio(id) {
  const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
    body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'es' } }, videoId: id }),
  });
  const j = await r.json();
  const durada = Number(j.videoDetails?.lengthSeconds || 0);
  const pistes = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  // La pista original en castellà és l'automàtica (asr); les altres solen ser doblatges.
  const pista = pistes.find(p => p.languageCode.startsWith('es') && p.kind === 'asr')
    || pistes.find(p => p.languageCode.startsWith('es')) || pistes[0];
  if (!pista) return { durada, text: null, estat: j.playabilityStatus?.status };
  const xml = await (await fetch(pista.baseUrl.replace('&fmt=srv3', ''))).text();
  const text = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map(([, t]) => entitats(entitats(t)).replace(/\s+/g, ' ').trim()).join(' ');
  return { durada, text, idioma: pista.languageCode };
}

const limit = Date.now() - DIES * 86400e3;
let nous = 0;
for (const c of canals) {
  let videos;
  try { videos = await llegeixFeed(c.canal); }
  catch (e) { console.log(`✗ ${c.nom}: no s'ha pogut llegir el feed (${e.message})`); continue; }
  for (const v of videos) {
    if (new Date(v.data) < limit || fets.has(v.id)) continue;
    const fitxer = path.join(dirPendents, `${v.id}.json`);
    if (fs.existsSync(fitxer)) continue;
    try {
      const t = await transcripcio(v.id);
      if (t.durada && t.durada < DURADA_MIN) { console.log(`· ${c.nom}: short descartat — ${v.titol}`); continue; }
      fs.writeFileSync(fitxer, JSON.stringify({ ...v, canal: c.id, durada: t.durada, idioma: t.idioma, text: t.text }, null, 1));
      nous++;
      console.log(`${t.text ? '✓' : '⚠ sense transcripció'} ${c.nom}: ${v.titol} (${Math.round(t.durada / 60)} min)`);
    } catch (e) { console.log(`✗ ${c.nom}: ${v.titol} — ${e.message}`); }
  }
}
console.log(`\n${nous} vídeos nous a pendents/`);
