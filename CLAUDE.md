# TransVideo — resum diari de vídeos de YouTube

App en català que cada dia resumeix els vídeos nous de Juan Ramón Rallo, Pablo Gil, Marc Vidal i Bitcoin al día.
No fa servir API de pagament: els resums els escriu Claude en una tasca programada cada dia (~12:45).

- **App:** https://oscarbellosido.github.io/TransVideo/ (GitHub Pages des de `main`)
- **Repo:** https://github.com/Oscarbellosido/TransVideo (públic)

## Estructura
- `canals.json` — canals (id intern, nom, channel_id de YouTube, color). Per afegir-ne un, cal el `channel_id` (UC…).
- `scripts/baixa.mjs` — llegeix l'RSS de cada canal i desa la transcripció dels vídeos nous a `pendents/<id>.json`. Descarta els shorts (< 3 min).
- `scripts/publica.mjs` — fusiona `pendents/<id>.resum.json`, `pendents/dia.json` i `pendents/setmana.json` amb `dades/resums.json`, regenera `dades/resums.js` i esborra els pendents.
- `index.html` — la pàgina. Llegeix `dades/resums.js`, per això funciona amb doble clic (file://).

## Procediment diari (el que fa la tasca programada)
1. `node scripts/baixa.mjs` (vídeos dels últims 7 dies que encara no s'han resumit; així es recuperen els dies que la tasca no s'ha executat).
   - Codi de sortida 2 = YouTube bloqueja les transcripcions (pàgina "Sorry"/CAPTCHA): l'script s'atura sense desar res dolent.
     Continua igualment amb els pendents que hi hagi (si n'hi ha) i digues-ho al missatge final. NO ho tornis a provar en bucle.
   - Els shorts descartats es desen a `dades/descartats.json` perquè no es tornin a consultar.
2. Per cada `pendents/<id>.json` (camps: titol, canal, data, durada, text): llegeix la transcripció SENCERA
   (les llargues, per trossos) i escriu `pendents/<id>.resum.json`:
   ```json
   { "resum": "2-3 frases: la tesi del vídeo",
     "punts": [{ "text": "punt clau concret, amb noms i xifres", "t": 754 }],
     "dades": ["xifres clau, 2-4"],
     "conclusio": "què se n'emporta l'espectador / què recomana l'autor",
     "temes": ["3-6 etiquetes curtes en minúscula"] }
   ```
   - 5-7 punts. `t` = segons des de l'inici del vídeo on es comença a explicar aquell punt: la transcripció porta marques
     `[m:ss]` cada ~30 s; fes servir la marca just anterior al passatge (p. ex. `[12:34]` → 754). Si no ho saps segur, omet `t`.
   - Si `text` és null (sense subtítols), resumeix a partir del títol i la `descripcio`, sense `t`, i digues-ho al resum.
3. Escriu `pendents/dia.json` amb el resum conjunt: `{ "data": "AAAA-MM-DD" (avui), "titular": "...", "punts": ["Tema. Text…"] }`.
   Cada punt comença amb una etiqueta curta acabada en punt o dos punts (la pàgina la posa en negreta).
   Creua els canals: on coincideixen i on discrepen. Si avui no hi ha cap vídeo nou, no l'escriguis.
4. **Resum setmanal**: si avui és diumenge, o si l'última entrada de `setmanes` a `dades/resums.json` té més de 7 dies
   (o no n'hi ha cap), escriu `pendents/setmana.json` a partir dels resums (no de les transcripcions) dels vídeos publicats
   els últims 7 dies, inclosos els d'avui:
   ```json
   { "data": "AAAA-MM-DD (avui)", "des_de": "AAAA-MM-DD (fa 6 dies)",
     "titular": "la idea de la setmana",
     "punts": ["Tema. 4-6 temes que han marcat la setmana, dient quin canal ho diu"],
     "coincideixen": ["Tema. on coincideixen dos o més canals"],
     "discrepen": ["Tema. on diuen coses diferents (qui diu què)"],
     "a_vigilar": ["Tema. dates, dades i nivells que els autors han dit que cal mirar la setmana vinent"] }
   ```
5. `node scripts/publica.mjs` (executa'l SEMPRE, encara que no hi hagi vídeos nous: actualitza la data `actualitzat`, i la pàgina avisa si fa més de 36 h que no canvia).
6. `git add -A && git commit -m "Resums AAAA-MM-DD" && git push` (repo propi d'aquesta carpeta; el push publica la web).

## Regles dels resums
- En català, frases curtes i clares. Sense ideologia afegida: explica què diu l'autor, no si té raó.
- No inventar res: ni noms (el presentador de Bitcoin al día no diu el seu nom), ni xifres, ni atribuir a un canal el que diu un altre.
- Ignora les falques publicitàries (Urbanitae, universitat, esdeveniments), llevat que siguin el tema.
- Les transcripcions són automàtiques: corregeix noms mal escrits si és evident (p. ex. «Hagin Face» = Hugging Face).

## Notes tècniques
- Les transcripcions es baixen amb l'API InnerTube (client ANDROID). La pista bona és `es` + `kind=asr`; les altres solen ser doblatges automàtics.
- La pàgina de YouTube redirigeix a consent.youtube.com: per resoldre un @handle cal la galeta `SOCS=CAI`.
- El bloqueig de YouTube sol ser temporal (hores). baixa.mjs espera 2,5 s entre vídeos per evitar-lo. Alternativa manual: llegir la transcripció amb l'extensió Claude a Chrome.
- `pendents/` (transcripcions) i `.claude/` no es pugen mai (.gitignore): al repo públic només hi van els resums.
- La carpeta d'usuari `C:\Users\Carles` també és un repo git: aquesta carpeta té el seu propi `.git`.
