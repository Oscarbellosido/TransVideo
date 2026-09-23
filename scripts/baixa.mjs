// Baixa els vídeos nous dels canals (RSS) i en desa la transcripció a pendents/<id>.json.
// Ús: node scripts/baixa.mjs [dies=7]
// Finestra àmplia a propòsit: si un dia la tasca no s'executa (PC apagat), l'endemà recupera
// els vídeos perduts. Els ja resumits (dades/resums.json) no es tornen a baixar.
// Codi de sortida 2 = YouTube bloqueja les transcripcions (s'atura i ho torna a provar la propera vegada).
import fs from 'node:fs';
import path from 'node:path';

const ARREL = path.resolve(import.meta.dirname, '..');
const DIES = Number(process.argv[2] || 7);
const DURADA_MIN = 180; // segons: descarta els shorts
const PAUSA_MS = 2500;  // entre vídeos, per no semblar un robot
const espera = ms => new Promise(r => setTimeout(r, ms));
// YouTube torna una pàgina "Sorry…" (CAPTCHA) quan detecta massa peticions.
class Bloqueig extends Error {}

const canals = JSON.parse(fs.readFileSync(path.join(ARREL, 'canals.json'), 'utf8'));
const fitxerResums = path.join(ARREL, 'dades', 'resums.json');
const fets = new Set(fs.existsSync(fitxerResums)
  ? JSON.parse(fs.readFileSync(fitxerResums, 'utf8')).videos.map(v => v.id) : []);
// Shorts ja descartats: així no es tornen a consultar cada dia.
const fitxerDescartats = path.join(ARREL, 'dades', 'descartats.json');
const descartats = new Set(fs.existsSync(fitxerDescartats) ? JSON.parse(fs.readFileSync(fitxerDescartats, 'utf8')) : []);
const dirPendents = path.join(ARREL, 'pendents');
fs.mkdirSync(dirPendents, { recursive: true });

const entitats = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n));
const mmss = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;

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
  const estat = j.playabilityStatus?.status;
  if (estat && estat !== 'OK' && /bot|sign in|inicia/i.test(j.playabilityStatus?.reason || '')) throw new Bloqueig(j.playabilityStatus.reason);
  const durada = Number(j.videoDetails?.lengthSeconds || 0);
  const pistes = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  // La pista original en castellà és l'automàtica (asr); les altres solen ser doblatges.
  const pista = pistes.find(p => p.languageCode.startsWith('es') && p.kind === 'asr')
    || pistes.find(p => p.languageCode.startsWith('es')) || pistes[0];
  if (!pista) return { durada, text: null };
  const xml = await (await fetch(pista.baseUrl.replace('&fmt=srv3', ''))).text();
  if (!xml.includes('<transcript')) throw new Bloqueig(/Sorry/.test(xml) ? 'pàgina "Sorry" (CAPTCHA)' : 'resposta inesperada dels subtítols');
  // Marca de temps [m:ss] cada ~30 s perquè els punts clau puguin enllaçar al minut exacte.
  let ultima = -Infinity;
  const text = [...xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)].map(([, ini, t]) => {
    const seg = Math.floor(Number(ini));
    const marca = seg - ultima >= 30 ? (ultima = seg, `[${mmss(seg)}] `) : '';
    return marca + entitats(entitats(t)).replace(/\s+/g, ' ').trim();
  }).join(' ');
  return { durada, text: text || null, idioma: pista.languageCode };
}

const limit = Date.now() - DIES * 86400e3;
let nous = 0, bloquejat = null;
for (const c of canals) {
  if (bloquejat) break;
  let videos;
  try { videos = await llegeixFeed(c.canal); }
  catch (e) { console.log(`✗ ${c.nom}: no s'ha pogut llegir el feed (${e.message})`); continue; }
  for (const v of videos) {
    if (new Date(v.data) < limit || fets.has(v.id) || descartats.has(v.id)) continue;
    if (/#shorts?\b/i.test(v.titol)) { descartats.add(v.id); continue; }
    const fitxer = path.join(dirPendents, `${v.id}.json`);
    if (fs.existsSync(fitxer)) continue;
    try {
      await espera(PAUSA_MS);
      const t = await transcripcio(v.id);
      if (t.durada && t.durada < DURADA_MIN) { descartats.add(v.id); console.log(`· ${c.nom}: short descartat — ${v.titol}`); continue; }
      // Els subtítols automàtics poden tardar hores a aparèixer: si el vídeo és recent, es torna a provar demà.
      if (!t.text && Date.now() - new Date(v.data) < 48 * 36e5) { console.log(`… ${c.nom}: encara sense subtítols, es provarà la propera vegada — ${v.titol}`); continue; }
      fs.writeFileSync(fitxer, JSON.stringify({ ...v, canal: c.id, durada: t.durada, idioma: t.idioma, text: t.text }, null, 1));
      nous++;
      console.log(`${t.text ? '✓' : '⚠ sense subtítols (es resumirà per la descripció)'} ${c.nom}: ${v.titol} (${Math.round(t.durada / 60)} min)`);
    } catch (e) {
      if (e instanceof Bloqueig) { bloquejat = e.message; break; }
      console.log(`✗ ${c.nom}: ${v.titol} — ${e.message}`);
    }
  }
}
fs.writeFileSync(fitxerDescartats, JSON.stringify([...descartats]));
console.log(`\n${nous} vídeos nous a pendents/`);
if (bloquejat) {
  console.log(`\n⛔ YOUTUBE BLOQUEJA LES TRANSCRIPCIONS (${bloquejat}). S'ha aturat per no empitjorar-ho.`);
  console.log(`   Els vídeos que falten es baixaran en la propera execució (finestra de ${DIES} dies).`);
  process.exitCode = 2;
}
