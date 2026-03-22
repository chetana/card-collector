# Architecture — Card Collector

## Vue d'ensemble

```
cards.chetana.dev (Cloud Run card-game)
         │
         │  Auth Google (GIS token)
         ▼
lys.chetana.dev/api/flashcards          ← liste des 20 cartes
lys.chetana.dev/api/flashcards/progress ← XP + sessions de l'utilisateur connecté
lys.chetana.dev/api/flashcards/collection ← les deux progressions (chet + lys)
         │
         ▼
GCS bucket: chet-lys-coffre
  flashcards/progress-chet.json
  flashcards/progress-lys.json
```

## Scènes Phaser

### LoadScene
- Fond manga avec lignes vitesse radiales
- Barre de progression animée
- `initAuth()` → Google GIS prompt (FedCM) ou bouton visible si UNSUPPORTED_OS
- `fetchCollection()` + `fetchCards()` en parallèle
- Transition vers CollectionScene avec `{ user, collection, cards }`

### CollectionScene
- Grille 2-3 colonnes (responsive selon largeur écran)
- Cartes `locked` (tramé, cadenas) ou `unlocked` (tramé manga + textes)
- Scroll tactile smooth (interpolation `Phaser.Math.Linear`)
- Tap → popup détail : KH + phonétique + FR + phonétique + EN
- Bouton VERSUS → VersusScene

### VersusScene
- Layout divisé en deux demi-écrans (ligne centrale dorée)
- Chaque côté : avatar niveau, XP, barre XP, compteur cartes, mini-grille 5×4
- Compteur cartes communes (maîtrisées par les deux)
- Déclaration gagnant ou égalité

## MangaCard (Phaser.Container)

Composant graphique pour une carte, dessiné en Graphics Phaser :

1. **Ombre portée** — rectangle décalé noir 40%
2. **Fond** — couleur selon état (locked/unlocked/mastered)
3. **Tramé manga** — grille de petits cercles (screen tone japonais)
4. **Bordure** — bleue accent (unlocked) ou dorée (mastered)
5. **Coins dorés** — lignes décoratives si mastered
6. **Contenu** — flag 🇰🇭, texte KH, phonétique KH, séparateur, flag 🇫🇷, texte FR, phonétique FR
7. **Glow WebGL** — `postFX.addGlow()` bleu ou doré

Animations :
- `reveal(delay)` — apparition avec `Back.easeOut` (rebond)
- `flip(onMid)` — scale X 1→0→1 (illusion 3D)
- `pulseUnlock()` — scale yoyo × 3

## Auth Google

Pattern : GIS FedCM avec fallback bouton visible.

```
initAuth()
  → google.accounts.id.initialize({ client_id, callback })
  → google.accounts.id.prompt(notification =>
      if (isNotDisplayed || UNSUPPORTED_OS) → showSignInButton()
    )
  → callback(credential) → JWT decode → GoogleUser
```

Le `client_id` est lu depuis `<meta name="google-signin-client_id">` dans index.html
(hardcodé, car les `VITE_*` env vars ne sont pas disponibles dans le build Docker Cloud Run).

## CORS

Les routes flashcard de `lys.chetana.dev` acceptent les origines :
- `https://card-game-267131866578.europe-west1.run.app`
- `https://cards.chetana.dev`
- `http://localhost:5174` (dev)

Implémenté via `src/lib/server/cors.ts` dans chet_lys.

## Déverrouillage des cartes

```typescript
// Une carte est débloquée si total_réponses_correctes_ou_approx >= seuil
const total = sessions.reduce((s, sess) => s + sess.correct + sess.approx, 0)
const unlocked = new Set<string>()
for (let i = 1; i <= Math.min(20, Math.floor(total / 5) + 1); i++) {
  unlocked.add(String(i))
}
```

Progression naturelle : après ~100 points de bonnes réponses cumulées, toutes les cartes sont débloquées.

## Variables d'environnement

Aucune variable d'environnement requise en production — tout est hardcodé dans `index.html` ou résolu au runtime via l'API.

En développement local, `.env` :
```
VITE_GOOGLE_CLIENT_ID=...  (lu uniquement en dev, pas en prod Docker)
VITE_API_BASE=             (vide = proxy Vite vers lys Cloud Run)
```
