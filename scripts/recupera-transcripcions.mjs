// Torna a baixar a transcripcions/ la transcripció dels vídeos ja resumits que no la tinguin (ús puntual).
// Ús: node scripts/recupera-transcripcions.mjs   · S'atura al primer bloqueig de YouTube.
import fs from 'node:fs';
import path from 'node:path';
const ARREL = path.resolve(import.meta.dirname, '..');
const d = JSON.parse(fs.readFileSync(ARREL + '/dades/resums.json', 'utf8'));
const canals = Object.fromEntries(JSON.parse(fs.readFileSync(ARREL + '/canals.json', 'utf8')).map(c => [c.id, c.nom]));
fs.mkdirSync(ARREL + '/transcripcions', { recursive: true });
const ent = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n));
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
for (const v of d.videos) {
  const f = `${ARREL}/transcripcions/${v.data.slice(0, 10)}_${v.canal}_${v.id}.txt`;
  if (fs.existsSync(f)) continue;
  await new Promise(r => setTimeout(r, 2500));
  const j = await (await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' }, body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'es' } }, videoId: v.id }) })).json();
  const ps = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const p = ps.find(p => p.languageCode.startsWith('es') && p.kind === 'asr') || ps.find(p => p.languageCode.startsWith('es'));
  if (!p) { console.log('sense subtítols', v.id); continue; }
  const xml = await (await fetch(p.baseUrl.replace('&fmt=srv3', ''))).text();
  if (!xml.includes('<transcript')) { console.log('BLOQUEIG, aturo'); break; }
  let u = -Infinity;
  const text = [...xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)].map(([, i, t]) => { const s = Math.floor(+i); return (s - u >= 30 ? (u = s, `\n[${mmss(s)}] `) : '') + ent(ent(t)).replace(/\s+/g, ' ').trim(); }).join(' ');
  fs.writeFileSync(f, `${canals[v.canal]} — ${v.titol}\n${v.data} · ${Math.round(v.durada / 60)} min\n${text}\n`);
  console.log('✓', v.canal, v.titol.slice(0, 50));
}
