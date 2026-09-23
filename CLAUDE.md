# TransVideo — resum diari de vídeos de YouTube

App en català que cada dia resumeix els vídeos nous de Juan Ramón Rallo, Pablo Gil, Marc Vidal i Bitcoin al día.
No fa servir API de pagament: els resums els escriu Claude en una tasca programada cada matí.

## Estructura
- `canals.json` — canals (id intern, nom, channel_id de YouTube, color). Per afegir-ne un, cal el `channel_id` (UC…).
- `scripts/baixa.mjs` — llegeix l'RSS de cada canal i desa la transcripció dels vídeos nous a `pendents/<id>.json`. Descarta els shorts (< 3 min).
- `scripts/publica.mjs` — fusiona `pendents/<id>.resum.json` i `pendents/dia.json` amb `dades/resums.json`, regenera `dades/resums.js` i esborra els pendents.
- `index.html` — la pàgina. Llegeix `dades/resums.js`, per això funciona amb doble clic (file://).

## Procediment diari (el que fa la tasca programada)
1. `node scripts/baixa.mjs 2` (vídeos de les últimes 48 h que encara no s'han resumit).
2. Per cada `pendents/<id>.json` (camps: titol, canal, data, durada, text): llegeix la transcripció SENCERA
   (les llargues, per trossos) i escriu `pendents/<id>.resum.json`:
   ```json
   { "resum": "2-3 frases: la tesi del vídeo",
     "punts": ["5-7 punts clau, concrets, amb noms i xifres"],
     "dades": ["xifres clau, 2-4"],
     "conclusio": "què se n'emporta l'espectador / què recomana l'autor",
     "temes": ["3-6 etiquetes curtes en minúscula"] }
   ```
   Si `text` és null (sense transcripció), resumeix a partir del títol i la `descripcio` i digues-ho al resum.
3. Escriu `pendents/dia.json` amb el resum conjunt: `{ "data": "AAAA-MM-DD" (avui), "titular": "...", "punts": ["Tema. Text…"] }`.
   Cada punt comença amb una etiqueta curta acabada en punt o dos punts (la pàgina la posa en negreta).
   Creua els canals: on coincideixen i on discrepen.
4. `node scripts/publica.mjs`.
5. `git add -A && git commit -m "Resums AAAA-MM-DD"` (repo propi d'aquesta carpeta).

## Regles dels resums
- En català, frases curtes i clares. Sense ideologia afegida: explica què diu l'autor, no si té raó.
- No inventar res: ni noms (el presentador de Bitcoin al día no diu el seu nom), ni xifres, ni atribuir a un canal el que diu un altre.
- Ignora les falques publicitàries (Urbanitae, universitat, esdeveniments), llevat que siguin el tema.
- Les transcripcions són automàtiques: corregeix noms mal escrits si és evident (p. ex. «Hagin Face» = Hugging Face).

## Notes tècniques
- Les transcripcions es baixen amb l'API InnerTube (client ANDROID). La pista bona és `es` + `kind=asr`; les altres solen ser doblatges automàtics.
- La pàgina de YouTube redirigeix a consent.youtube.com: per resoldre un @handle cal la galeta `SOCS=CAI`.
- Si YouTube bloqueja la IP (CAPTCHA), alternativa: llegir la transcripció amb l'extensió Claude a Chrome.
- La carpeta d'usuari `C:\Users\Carles` també és un repo git: aquesta carpeta té el seu propi `.git`.
