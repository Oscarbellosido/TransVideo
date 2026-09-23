# 📺 Resum de vídeos

Resum diari, en català, dels vídeos de YouTube de:

- **Juan Ramón Rallo**
- **Pablo Gil**
- **Marc Vidal**
- **Bitcoin al día**

**App:** https://oscarbellosido.github.io/TransVideo/

## Com funciona

1. Cada dia, cap a les 12:45, una tasca programada de Claude (a l'app d'escriptori) executa `scripts/baixa.mjs`, que llegeix l'RSS de cada canal i baixa la transcripció dels vídeos nous. Els shorts es descarten.
2. Claude llegeix cada transcripció sencera i n'escriu el resum: tesi, punts clau, xifres, conclusió i temes. També escriu un resum conjunt del dia que creua els quatre canals.
3. `scripts/publica.mjs` ho afegeix a `dades/resums.json` i `dades/resums.js`, i la tasca en fa commit i push. GitHub Pages publica la pàgina actualitzada.

No hi ha build ni dependències: `index.html` es pot obrir directament amb doble clic.

## Afegir un canal

Afegeix-lo a `canals.json` amb el seu `channel_id` (comença per `UC…`).

> Els resums es fan a partir de transcripcions automàtiques i poden contenir errors. En cas de dubte, mira el vídeo.
