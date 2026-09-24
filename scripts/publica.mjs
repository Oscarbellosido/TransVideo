// Afegeix els resums escrits a pendents/ a dades/resums.json i regenera dades/resums.js.
//   pendents/<id>.resum.json  → resum d'un vídeo (cal el pendents/<id>.json corresponent)
//   pendents/dia.json         → resum conjunt del dia { data, titular, punts[] }
//   pendents/setmana.json     → resum setmanal { data, des_de, titular, punts[], coincideixen[], discrepen[], a_vigilar[] }
// Ús: node scripts/publica.mjs
import fs from 'node:fs';
import path from 'node:path';

const ARREL = path.resolve(import.meta.dirname, '..');
const P = f => path.join(ARREL, 'pendents', f);
const fitxer = path.join(ARREL, 'dades', 'resums.json');
const dades = fs.existsSync(fitxer) ? JSON.parse(fs.readFileSync(fitxer, 'utf8')) : { videos: [], dies: {} };
dades.setmanes ||= {};

// Data del lot: la del resum del dia si n'hi ha, si no la d'avui (hora local).
const avui = new Date().toLocaleDateString('sv-SE');
const lot = fs.existsSync(P('dia.json')) ? JSON.parse(fs.readFileSync(P('dia.json'), 'utf8')).data : avui;
let afegits = 0;
for (const f of fs.readdirSync(path.join(ARREL, 'pendents')).filter(f => f.endsWith('.resum.json'))) {
  const id = f.replace('.resum.json', '');
  if (!fs.existsSync(P(`${id}.json`))) { console.log(`✗ falta pendents/${id}.json`); continue; }
  const { text, descripcio, ...meta } = JSON.parse(fs.readFileSync(P(`${id}.json`), 'utf8'));
  const resum = JSON.parse(fs.readFileSync(P(f), 'utf8'));
  delete resum.id;
  dades.videos = dades.videos.filter(v => v.id !== id);
  dades.videos.push({ ...meta, ...resum, lot });
  fs.unlinkSync(P(f)); fs.unlinkSync(P(`${id}.json`));
  if (fs.existsSync(P(`${id}.txt`))) fs.unlinkSync(P(`${id}.txt`));
  afegits++;
}
if (fs.existsSync(P('dia.json'))) {
  const dia = JSON.parse(fs.readFileSync(P('dia.json'), 'utf8'));
  dades.dies[dia.data] = { titular: dia.titular, punts: dia.punts };
  fs.unlinkSync(P('dia.json'));
  console.log(`✓ resum del dia ${dia.data}`);
}
if (fs.existsSync(P('setmana.json'))) {
  const { data, ...setmana } = JSON.parse(fs.readFileSync(P('setmana.json'), 'utf8'));
  dades.setmanes[data] = setmana;
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
