# Card Collector · Chet & Lys

Jeu de collection de cartes FR↔KH en 2D style manga, basé sur les flashcards apprises dans [lys.chetana.dev](https://lys.chetana.dev).

## URLs

- **Prod** : `https://card-game-267131866578.europe-west1.run.app` / `https://cards.chetana.dev`
- **Backend API** : `https://lys.chetana.dev/api/flashcards/*`
- **Repo** : `https://github.com/chetana/card-collector`

## Stack

- **Phaser 3** (v3.90) — moteur de jeu 2D WebGL/Canvas
- **TypeScript** + **Vite** — build tooling
- **Cloud Run** (europe-west1) — hébergement container statique via `serve`
- **Auth** : Google Identity Services (GIS) — même Client ID que lys.chetana.dev
- **Données** : API lys.chetana.dev (CORS autorisé) → GCS `chet-lys-coffre`

## Structure

```
src/
  main.ts              — Config Phaser (390×844, FIT scale, noAudio)
  scenes/
    LoadScene.ts       — Splash manga + auth Google + fetch data
    CollectionScene.ts — Grille cartes, scroll tactile, popup détail
    VersusScene.ts     — Chet vs Lys side-by-side, stats comparatives
  objects/
    MangaCard.ts       — Carte Phaser.Container : tramé, glow, flip 3D
  api/
    auth.ts            — Google GIS auth, FedCM + fallback bouton visible
    progress.ts        — Types, fetch collection/cards, level helpers
```

## Développement

```bash
npm install
npm run dev      # http://localhost:5174 (proxy → lys Cloud Run)
npm run build    # build dans dist/
```

## Déploiement

```bash
gcloud run deploy card-game \
  --source . \
  --region europe-west1 \
  --project cykt-399216 \
  --allow-unauthenticated \
  --port 8080
```

Le Dockerfile construit le projet Vite puis sert `dist/` via `serve`.

## Mécanique de déverrouillage

Une carte est débloquée progressivement selon le XP total dans les sessions flashcard :
- XP = `correct × 10 + approx × 5 + wrong × 1` par session
- Toutes les 5 points de "réponses cumulées", une nouvelle carte s'ouvre
- Les données viennent de `GCS: flashcards/progress-{name}.json`

## Voir aussi

- [docs/architecture.md](docs/architecture.md) — architecture détaillée
- [lys.chetana.dev](https://lys.chetana.dev) — app couple source des données
