// Afegeix els resums escrits a pendents/ a dades/resums.json i regenera dades/resums.js.
//   pendents/<id>.resum.json  → resum d'un vídeo (cal el pendents/<id>.json corresponent)
//   pendents/dia.json         → resum conjunt del dia { data, titular, punts[] }
//   pendents/setmana.json     → resum setmanal { data, des_de, titular, punts[], coincideixen[], discrepen[], a_vigilar[] }
// Ús: node scripts/publica.mjs [--push]
//   --push: a més, fa git add/commit/push de dades/ (així la tasca programada només necessita permís per a aquesta ordre).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ARREL = path.resolve(import.meta.dirname, '..');
const P = f => path.join(ARREL, 'pendents', f);
const fitxer = path.join(ARREL, 'dades', 'resums.json');
const dades = fs.existsSync(fitxer) ? JSON.parse(fs.readFileSync(fitxer, 'utf8')) : { videos: [], dies: {} };
dades.setmanes ||= {};

// Les dates han de ser AAAA-MM-DD exactes: altres apps (Economia) en depenen. Si el model hi afegeix
// text ("2026-09-27 (avui)"), se'n treu la data; si no n'hi ha cap, s'atura.
const nomesData = (x, on) => {
  const m = String(x ?? '').match(/\d{4}-\d{2}-\d{2}/);
  if (!m) throw new Error(`Data no vàlida a ${on}: "${x}"`);
  if (m[0] !== x) console.log(`⚠ Data corregida a ${on}: "${x}" → "${m[0]}"`);
  return m[0];
};
// Data del lot: la del resum del dia si n'hi ha, si no la d'avui (hora local).
const avui = new Date().toLocaleDateString('sv-SE');
const lot = fs.existsSync(P('dia.json')) ? nomesData(JSON.parse(fs.readFileSync(P('dia.json'), 'utf8')).data, 'dia.json') : avui;
let afegits = 0;
for (const f of fs.readdirSync(path.join(ARREL, 'pendents')).filter(f => f.endsWith('.resum.json'))) {
  const id = f.replace('.resum.json', '');
  if (!fs.existsSync(P(`${id}.json`))) { console.log(`✗ falta pendents/${id}.json`); continue; }
  const { text, descripcio, ...meta } = JSON.parse(fs.readFileSync(P(`${id}.json`), 'utf8'));
  const resum = JSON.parse(fs.readFileSync(P(f), 'utf8'));
  if (typeof resum.resum !== 'string' || !Array.isArray(resum.punts)) { console.log(`✗ ${f}: falta "resum" o "punts"; no es publica`); continue; }
  // El resum ha de dir de quin vídeo és (títol copiat del .txt): el 29/9/2026 se'n van intercanviar dos
  // de canals diferents. Si no quadra, no es publica i es queda a pendents/ per revisar-lo.
  const norm = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  if (norm(resum.titol) !== norm(meta.titol)) {
    console.log(`✗ ${f}: el "titol" del resum ("${resum.titol ?? 'cap'}") no és el del vídeo ("${meta.titol}"). NO es publica: revisa que el resum sigui d'aquest vídeo.`);
    process.exitCode = 1;
    continue;
  }
  delete resum.id; delete resum.titol; delete resum.canal;
  dades.videos = dades.videos.filter(v => v.id !== id);
  dades.videos.push({ ...meta, ...resum, lot });
  fs.unlinkSync(P(f)); fs.unlinkSync(P(`${id}.json`));
  // La transcripció es guarda a transcripcions/ (només en aquest PC, no es puja: .gitignore)
  // perquè altres apps (p. ex. Economia) la puguin consultar.
  if (fs.existsSync(P(`${id}.txt`))) {
    const arxiu = path.join(ARREL, 'transcripcions');
    fs.mkdirSync(arxiu, { recursive: true });
    fs.renameSync(P(`${id}.txt`), path.join(arxiu, `${meta.data.slice(0, 10)}_${meta.canal}_${id}.txt`));
  }
  afegits++;
}
if (fs.existsSync(P('dia.json'))) {
  const dia = JSON.parse(fs.readFileSync(P('dia.json'), 'utf8'));
  dades.dies[nomesData(dia.data, 'dia.json')] = { titular: dia.titular, punts: dia.punts };
  fs.unlinkSync(P('dia.json'));
  console.log(`✓ resum del dia ${dia.data}`);
}
if (fs.existsSync(P('setmana.json'))) {
  const { data, ...setmana } = JSON.parse(fs.readFileSync(P('setmana.json'), 'utf8'));
  setmana.des_de = nomesData(setmana.des_de, 'setmana.json (des_de)');
  dades.setmanes[nomesData(data, 'setmana.json')] = setmana;
  fs.unlinkSync(P('setmana.json'));
  console.log(`✓ resum setmanal ${setmana.des_de} → ${data}`);
}
dades.videos.sort((a, b) => b.data.localeCompare(a.data));
dades.actualitzat = new Date().toISOString();
fs.writeFileSync(fitxer, JSON.stringify(dades, null, 1));
// Còpia en .js perquè index.html funcioni obrint-lo amb doble clic (file:// no permet fetch).
const canals = JSON.parse(fs.readFileSync(path.join(ARREL, 'canals.json'), 'utf8'));
fs.writeFileSync(path.join(ARREL, 'dades', 'resums.js'), `window.CANALS = ${JSON.stringify(canals)};\nwindow.RESUMS = ${JSON.stringify(dades)};\n`);
console.log(`${afegits} resums afegits · ${dades.videos.length} vídeos en total`);
const queden = fs.readdirSync(path.join(ARREL, 'pendents')).filter(f => f.endsWith('.json'));
if (queden.length) console.log(`Queden per resumir: ${queden.join(', ')}`);

if (process.argv.includes('--push')) {
  const git = (...a) => execFileSync('git', a, { cwd: ARREL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('add', 'dades');
    if (!git('diff', '--cached', '--name-only').trim()) console.log('Git: res a publicar.');
    else {
      git('commit', '-m', `Resums ${new Date().toLocaleDateString('sv-SE')}`);
      git('push');
      console.log('Git: commit i push fets (la web s\'actualitza en 1-2 minuts).');
    }
  } catch (e) {
    console.log(`✗ Git ha fallat: ${(e.stderr || e.message).toString().trim()}`);
    process.exitCode = 1;
  }
}
