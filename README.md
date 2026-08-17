# The Imposter

> Trouve l'intrus. Ou fais semblant.
>
> Un projet [by amineflex](https://amineflex.is-a.dev).

Party game social de déduction en français, jouable **à plusieurs sur un seul
téléphone** (hors connexion) ou **en ligne, un appareil par joueur**.
Deux modes : **Imposteur** et **Undercover**. 3 à 12 joueurs.

---

## Sommaire

1. [Présentation](#1-présentation)
2. [Stack technique](#2-stack-technique)
3. [Architecture](#3-architecture)
4. [Installation](#4-installation)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Mise en place de Supabase](#6-mise-en-place-de-supabase)
7. [Migrations](#7-migrations)
8. [Seed de la base de mots](#8-seed-de-la-base-de-mots)
9. [Développement](#9-développement)
10. [Tests](#10-tests)
11. [Déploiement Vercel](#11-déploiement-vercel)
12. [Règles du jeu](#12-règles-du-jeu)
13. [Sécurité](#13-sécurité)
14. [Architecture realtime](#14-architecture-realtime)
15. [Expiration des rooms](#15-expiration-des-rooms)
16. [Extensions futures](#16-extensions-futures)

---

## 1. Présentation

| | |
|---|---|
| **Joueurs** | 3 à 12 |
| **Durée** | 5 à 15 minutes par partie |
| **Langue** | Français (architecture i18n prête pour d'autres langues) |
| **Modes** | Imposteur, Undercover |
| **Supports** | Mobile d'abord (dès 320 px), tablette, desktop |
| **PWA** | Installable, mode local jouable hors connexion |
| **Thème** | Clair unique (crème + aplats colorés) |

**Mode Imposteur** — tout le monde connaît le même mot secret, sauf l'imposteur
qui ne reçoit qu'un indice général (`Girafe` → indice `Animal`). Chacun décrit
son mot ; les joueurs votent pour démasquer l'intrus.

**Mode Undercover** — les Civils ont un mot, l'Undercover un mot voisin
(`Coca-Cola` / `Pepsi`), et Mr. White n'a aucun mot. S'il est éliminé, Mr. White
a une dernière chance : deviner le mot des Civils pour gagner immédiatement.

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Style | Tailwind CSS 3 + design system maison « party game », Lucide, Framer Motion |
| État client | Zustand (préférences + moteur local) |
| Validation | Zod (client **et** serveur) |
| Base de données | Supabase / PostgreSQL, Row Level Security |
| Temps réel | Supabase Realtime (`postgres_changes`) |
| Auth | Supabase Anonymous Auth (joueurs), email/mot de passe (admins) |
| Tests | Vitest (unitaires + scénarios), Playwright (E2E) |
| Hébergement | Vercel (front + API), Supabase (données) |

Aucune dépendance externe n'est requise à l'exécution pour le mode local :
la base de mots est embarquée, les sons sont générés par la Web Audio API et les
icônes/avatars sont dessinés en SVG ou générés par script.

---

## 3. Architecture

```text
src/
├── app/                        # App Router
│   ├── page.tsx                # Accueil
│   ├── local/                  # Mode local (hot-seat, offline)
│   ├── online/                 # Créer / rejoindre
│   ├── join/[code]/            # Saisie du pseudo
│   ├── room/[code]/            # Salon + partie en ligne
│   ├── regles/                 # Comment jouer
│   ├── admin/                  # Dashboard admin (auth email)
│   ├── hors-connexion/         # Page de repli PWA
│   └── api/                    # Route handlers = AUTORITÉ du jeu en ligne
│       ├── room/{create,join,leave,settings,kick,start,rematch,cancel}
│       ├── game/{me,reveal,vote,advance,tick,mr-white,pause}
│       ├── chat/send · rooms/public · report
│       ├── admin/{words,rooms,reports,settings}
│       └── cron/cleanup        # Expiration des rooms
├── components/
│   ├── party/                  # DESIGN SYSTEM du jeu (PartyButton, PartyCard,
│   │                           # StickerBadge, PlayerBubble, GameBanner,
│   │                           # Countdown, RoleRevealCard, ResultBurst,
│   │                           # PopModal, GameLogo, décor géométrique)
│   ├── ui/                     # Primitives techniques (Radix + cva), utilisées
│   │                           # surtout par l'administration
│   ├── game/                   # Avatars, maintien-pour-révéler, tuiles de vote
│   └── layout/                 # Bandeau offline, service worker, son
├── features/
│   ├── game/                   # Composants partagés local + online
│   ├── local-game/             # Store et écrans du mode local
│   ├── online-game/            # useRoom, phases, chat, lobby
│   ├── lobby/                  # Formulaires de code / pseudo
│   └── admin/                  # Dashboard
├── lib/
│   ├── game-engine/            # MOTEUR PUR (aucune dépendance React/Supabase)
│   ├── game/                   # Persistance + service serveur
│   ├── supabase/               # client navigateur / serveur / service_role
│   ├── validations/            # Schémas Zod
│   └── api/                    # Helpers HTTP, permissions, anti-abus
├── data/                       # Base de mots (source unique du seed)
├── hooks/ · stores/ · types/ · i18n/
supabase/
├── migrations/                 # Schéma, RLS, fonctions, vues
└── seed.sql                    # GÉNÉRÉ depuis src/data
```

### Le moteur de jeu est pur et partagé

`src/lib/game-engine/` ne connaît ni React, ni Supabase, ni le DOM. Il expose
des fonctions pures sur un `GameState` : attribution des rôles, machine d'état,
ordre de parole, votes, égalités, conditions de victoire, Mr. White.

Ce même moteur est utilisé :

- **en local** par un store Zustand (`features/local-game/local-store.ts`),
- **en ligne** par les route handlers, via
  `lib/game/persistence.ts` (base ↔ `GameState`) et `lib/game/service.ts`.

Les règles ne sont donc écrites **qu'une seule fois** et sont testables sans
navigateur ni base de données.

### Machine d'état

```text
LOBBY → ROLE_ASSIGNMENT → ROLE_REVEAL → DISCUSSION → VOTING → VOTE_RESULT
      → ELIMINATION → [MR_WHITE_GUESS] → NEXT_ROUND → DISCUSSION …
                                       → GAME_OVER → RESULTS → (rematch) LOBBY
```

Les transitions autorisées sont déclarées dans
`lib/game-engine/state-machine.ts` ; toute transition hors table lève une
`IllegalTransitionError`. `VOTE_RESULT → VOTING` gère le vote de barrage.

### Direction artistique

Identité « party game de console » : fond **crème**, **aplats** de couleurs
franches, **contours d'encre** épais, **ombres dures** et typographie ronde
(Baloo 2 pour les titres, Nunito pour le texte).

Règles tenues dans tout le projet :

- aucun gradient (ni linear, ni radial, ni conic),
- aucun flou (`blur`, `backdrop-filter`),
- aucune lueur / néon / transparence décorative,
- ombres **franches** uniquement (`0 6px 0 ink`), jamais diffuses,
- 2 à 3 couleurs dominantes par écran, la couleur structure l'information.

Tous les tokens (palette, rayons, contours, ombres, durées) vivent dans
`src/app/globals.css` et sont exposés à Tailwind via `tailwind.config.ts` :
aucun composant n'écrit une couleur ou une ombre en dur.

| Token | Valeur |
|---|---|
| `--cream` / `--paper` | fond de scène / surfaces de cartes |
| `--ink` / `--ink-soft` | contours et textes |
| `--red` `--yellow` `--blue` `--green` `--pink` `--orange` `--purple` | accents |
| `--shadow-sm/md/lg` | `0 3px 0`, `0 6px 0`, `0 9px 0` en encre |
| `--motion-tap/fast/base/slow` | 100 / 160 / 220 / 300 ms |

Les boutons s'enfoncent réellement (`translateY(4px)` + ombre écrasée), les
cartes sont légèrement inclinées, et les décors sont des formes géométriques en
aplats (étoiles, ronds, triangles, losanges). L'administration reste
volontairement sobre et classique.

---

## 4. Installation

Prérequis : **Node.js ≥ 20**, un projet **Supabase** (gratuit suffit).

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

Le mode local fonctionne immédiatement, **même sans Supabase configuré**.
Le mode en ligne et l'administration nécessitent les variables ci-dessous.

---

## 5. Variables d'environnement

| Variable | Portée | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + serveur | Clé publique (lectures sous RLS) |
| `NEXT_PUBLIC_SITE_URL` | client | URL publique (liens de partage, QR, OG) |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur uniquement** | Écritures du jeu (contourne la RLS) |
| `CRON_SECRET` | **serveur uniquement** | Protège `/api/cron/cleanup` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être préfixée par
> `NEXT_PUBLIC_`. Elle n'est importée que par `lib/supabase/admin.ts`, utilisé
> exclusivement dans les route handlers et les composants serveur.

---

## 6. Mise en place de Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **Authentication → Providers → Anonymous sign-ins** : activer.
   (Indispensable : les joueurs n'ont pas de compte, l'identité anonyme sert à
   appliquer la RLS et à gérer la reconnexion.)
3. **Authentication → Providers → Email** : activer (comptes admin).
4. Récupérer dans **Project Settings → API** : *Project URL*, *anon key*,
   *service_role key* → les placer dans `.env.local`.
5. Exécuter les migrations puis le seed (sections suivantes).
6. Créer un administrateur :
   - **Authentication → Users → Add user** (email + mot de passe, « Auto
     confirm user »),
   - puis, dans le **SQL Editor** :

   ```sql
   insert into admins (user_id, email)
   select id, email from auth.users where email = 'vous@example.com';
   ```

7. **Database → Replication** : vérifier que la publication `supabase_realtime`
   contient bien `rooms`, `room_players`, `games`, `game_player_status`,
   `chat_messages` (la migration les ajoute automatiquement).

---

## 7. Migrations

**Option A — Supabase CLI (recommandé)**

```bash
npm i -g supabase
supabase link --project-ref <votre-ref>
supabase db push
```

**Option B — SQL Editor**

Copier-coller le contenu de `supabase/migrations/20250101000000_init.sql` dans
le SQL Editor du dashboard, puis exécuter.

La migration crée : les enums, 19 tables, les index, les contraintes, les
politiques RLS, les vues publiques (`game_public_state`, `public_rooms`), les
fonctions (`is_admin`, `is_room_member`, `is_game_member`, `rate_limit_hit`,
`cleanup_rooms`, `admin_stats`) et la publication Realtime.

---

## 8. Seed de la base de mots

```bash
# Avec la CLI
supabase db reset          # migrations + seed.sql automatiquement
# ou, pour seeder seulement :
psql "$DATABASE_URL" -f supabase/seed.sql
```

Sans CLI : copier `supabase/seed.sql` dans le SQL Editor. Le fichier est
**idempotent** (`on conflict do update`) : on peut le rejouer sans risque.

Contenu du seed :

| | Nombre |
|---|---|
| Catégories | 18 |
| Packs | 10 (Classique, Nourriture, Animaux, Monde, Gaming, Films & séries, Sport, Difficile, Fun, France/Belgique) |
| Mots mode Imposteur (mot + indice) | 457 |
| Paires mode Undercover | 427 |
| **Total entrées jouables** | **884** |

### Source unique

La base de mots est écrite **une seule fois** en TypeScript
(`src/data/impostor-words.ts`, `src/data/word-pairs.ts`) puis :

- importée directement par le mode local (donc disponible hors connexion),
- compilée en SQL par `npm run seed:generate` → `supabase/seed.sql`.

Après toute modification des fichiers `src/data/*`, régénérer le seed :

```bash
npm run seed:generate
```

Un test (`src/data/__tests__/words.test.ts`) vérifie l'absence de doublons, la
validité des packs, la cohérence des paires et le fait qu'un indice ne révèle
jamais son mot.

---

## 9. Développement

```bash
npm run dev            # serveur de développement
npm run build          # build de production
npm start              # serveur de production
npm run typecheck      # TypeScript strict, sans émission
npm run lint           # ESLint (config Next.js)
npm run test           # tests unitaires (Vitest)
npm run test:e2e       # tests E2E (Playwright)
npm run seed:generate  # régénère supabase/seed.sql depuis src/data
npm run icons          # régénère les icônes PWA et l'image OpenGraph
```

Le service worker n'est **pas** enregistré en développement, afin que le cache
ne masque pas les changements de code.

---

## 10. Tests

### Unitaires et scénarios (Vitest) — 116 tests

| Fichier | Couverture |
|---|---|
| `game-engine/__tests__/roles.test.ts` | compositions de référence (4/5/8/12 joueurs), civils toujours majoritaires, configurations invalides rejetées, pondération de l'équité des rôles (mesurée statistiquement) |
| `game-engine/__tests__/engine.test.ts` | attribution des mots, rotation du premier orateur, passes de description, votes (auto-vote, double vote, joueur éliminé), égalité + barrage + résolution aléatoire, Mr. White, transitions interdites, AFK |
| `game-engine/__tests__/scenarios.test.ts` | parties complètes des deux modes jusqu'à la victoire, départ d'un joueur pendant le vote, victoire de Mr. White, invariants de sécurité (imposteur sans mot, aucun rôle révélé avant l'heure) |
| `game-engine/__tests__/mr-white.test.ts` | normalisation casse/accents/ponctuation, synonymes acceptés, refus des correspondances partielles |
| `game-engine/__tests__/word-selection.test.ts` | filtres packs/difficulté, anti-répétition et dégradation progressive |
| `validations/__tests__/schemas.test.ts` | pseudos Unicode, codes de room, réglages, chat, mots personnalisés, votes |
| `lib/__tests__/room-code.test.ts` | alphabet sans caractères ambigus, normalisation, attribution des avatars |
| `data/__tests__/words.test.ts` | qualité de la base de mots |
| `features/local-game/__tests__/local-store.test.ts` | fenêtre de révélation du mode local : aucun rôle affichable hors de son tour, autorisation révoquée dès le passage du téléphone (régression de fuite de mot) |

### E2E (Playwright)

```bash
npx playwright install chromium   # une seule fois
npm run test:e2e
```

`e2e/local-game.spec.ts` couvre le parcours réel : accueil → saisie des joueurs
→ blocage sous 3 joueurs → refus des doublons → distribution des rôles avec
appui maintenu et passage du téléphone (en vérifiant qu'aucune carte de rôle ne
subsiste après le passage) → descriptions → vote hot-seat → résultat et
élimination, plus la page hors connexion.

`e2e/visual-tour.spec.ts` parcourt les mêmes écrans en enregistrant une capture
de chacun — pratique pour relire le rendu mobile après un changement de design :

```bash
SHOTS_DIR=./captures npx playwright test visual-tour --project=mobile
```

`e2e/responsive.spec.ts` vérifie l'absence de débordement horizontal sur toutes
les pages à 320 / 360 / 390 / 430 / 1280 px, et que `prefers-reduced-motion`
neutralise bien animations et transitions.

Les tests tournent en profils **mobile (Pixel 7)** et **desktop**, sans Supabase
(**76 tests** au total).

---

## 11. Déploiement Vercel

1. Pousser le dépôt sur GitHub, puis **Import Project** sur Vercel
   (framework détecté automatiquement : Next.js).
2. **Settings → Environment Variables** : ajouter les 5 variables de la
   section 5 (`SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET` **sans** le préfixe
   `NEXT_PUBLIC_`).
3. Déployer, puis mettre `NEXT_PUBLIC_SITE_URL` à l'URL finale et redéployer
   (utilisée pour les liens de partage, les QR codes et les métadonnées OG).
4. Nettoyage automatique des rooms — créer `vercel.json` à la racine :

   ```json
   {
     "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 * * * *" }]
   }
   ```

   Vercel Cron envoie automatiquement l'en-tête
   `Authorization: Bearer $CRON_SECRET`. Sans plan Cron, appeler l'endpoint
   depuis n'importe quel ordonnanceur externe avec le même en-tête.

### Checklist de mise en production

- [ ] Anonymous sign-ins activé dans Supabase
- [ ] Migrations exécutées, seed injecté (884 entrées)
- [ ] Au moins un compte dans la table `admins`
- [ ] `NEXT_PUBLIC_SITE_URL` = URL de production
- [ ] Cron `/api/cron/cleanup` planifié
- [ ] `npm run build`, `npm run lint` et `npm run test` verts

---

## 12. Règles du jeu

### Déroulement

1. **Distribution** — chaque joueur consulte son rôle (appui maintenu).
2. **Descriptions** — chacun décrit son mot à son tour, sans le prononcer.
   1, 2, 3 passes ou discussion libre ; minuteur configurable.
3. **Vote** — chaque joueur vivant vote (jamais pour soi-même). Les votes sont
   **secrets** : seul le compteur « x / y joueurs ont voté » est visible.
4. **Résultat** — les votes sont révélés, le joueur majoritaire est éliminé.
   En cas d'égalité, un **barrage** est organisé entre les joueurs à égalité ;
   si l'égalité persiste, le sort tranche (garantie de terminaison).
5. **Mr. White** — s'il est éliminé, il tente de deviner le mot des Civils.
6. La partie continue jusqu'à ce qu'une condition de victoire soit remplie.

### Conditions de victoire

Implémentées dans `lib/game-engine/win.ts` (source unique, testée) :

| Mode | Camp | Condition |
|---|---|---|
| Imposteur | Joueurs (civils) | Tous les imposteurs sont éliminés |
| Imposteur | Imposteurs | Imposteurs vivants ≥ civils vivants (domination) |
| Undercover | Civils | Tous les intrus (Undercover + Mr. White) sont éliminés |
| Undercover | Intrus | Intrus vivants ≥ civils vivants (domination) |
| Undercover | Mr. White | Il devine le mot des Civils au moment de son élimination → victoire immédiate |

Chaque tour élimine au plus un joueur, donc la partie termine toujours. Cas
limite : si **aucun** vote n'est exprimé pendant deux scrutins consécutifs
(table entièrement AFK), la partie est **abandonnée** (`winner: null`) au lieu
de boucler indéfiniment.

### Composition automatique

Le nombre d'intrus vise ≈ ¼ de la table, borné à 1 minimum et à
`floor((n-1)/2)` maximum pour que les civils soient toujours strictement
majoritaires au départ. À 3 joueurs, la partie se joue donc en une élimination :
soit l'intrus tombe (victoire des civils), soit la parité est atteinte (victoire
des intrus).

| Joueurs | Undercover | Imposteur |
|---|---|---|
| 3 | 2 civils + 1 Undercover | 2 civils + 1 Imposteur |
| 4 | 3 civils + 1 Undercover | 3 civils + 1 Imposteur |
| 5 | 3 civils + 1 UC + 1 Mr. White | 4 + 1 |
| 8 | 6 civils + 1 UC + 1 Mr. White | 6 + 2 |
| 12 | 9 civils + 2 UC + 1 Mr. White | 10 + 2 |

L'hôte peut modifier la proposition dans les limites valides.

### Équité des rôles au rematch

Chaque joueur porte un poids `1 / (1 + 1,5 × rôles spéciaux récents)`, et les
rôles spéciaux sont tirés par échantillonnage pondéré sans remise. Un joueur qui
vient d'être imposteur a nettement moins de chances de l'être à nouveau (≈ 5 %
au lieu de 17 % à 6 joueurs, mesuré par test), sans que l'attribution devienne
prévisible.

---

## 13. Sécurité

### Principe : le client ne reçoit que ce qu'il a le droit de voir

Les rôles et les mots ne sont **jamais** envoyés en bloc au navigateur pour être
masqués visuellement. Ouvrir les DevTools, inspecter les réponses réseau, lire
le state React ou interroger Supabase directement ne révèle rien de plus.

| Donnée | Où elle vit | Qui peut la lire |
|---|---|---|
| Rôle et mot personnels | `game_players` | **uniquement le joueur concerné** (RLS `user_id = auth.uid()`), et tous les membres après la fin de partie |
| Mot des civils / undercover / indice | `games` | personne côté client pendant la partie ; exposés par la vue `game_public_state` **seulement** en phase `results` |
| Vote individuel | `votes` | uniquement son auteur, jusqu'à la fin de la partie |
| Vivant / éliminé / rôle révélé / a voté | `game_player_status` | tous les membres de la room (aucune donnée sensible) |
| Compteurs anti-abus | `rate_limits` | **aucune politique de lecture** : invisible du client |

### Écritures

Le client **n'écrit jamais** dans les tables de jeu : aucune politique
`INSERT`/`UPDATE` ne lui est accordée. Toutes les mutations passent par les
route handlers `/api/*`, qui :

1. identifient l'appelant (`supabase.auth.getUser()` via cookies),
2. valident l'entrée avec Zod,
3. vérifient les permissions (membre de la room, hôte, joueur vivant, bon
   destinataire pour Mr. White),
4. appliquent le **moteur** sur l'état rechargé depuis la base,
5. écrivent avec la clé `service_role` sous **verrou optimiste**.

### Protections spécifiques

- **Changement de phase** — `/api/game/advance` n'accepte une transition que si
  le minuteur est écoulé, s'il s'agit d'une phase d'affichage automatique, si
  c'est l'orateur courant qui termine, ou si l'hôte force. La table de
  transitions rejette tout le reste.
- **Concurrence** — la colonne `games.version` sert de verrou optimiste
  (`update … where version = $lu`) : si deux clients avancent la partie au même
  instant, une seule écriture passe, l'autre reçoit un conflit sans effet de
  bord (double élimination impossible).
- **Double vote** — index unique `(game_id, round, runoff, voter_id)` :
  garanti même en cas de requêtes simultanées. Auto-vote refusé par une
  contrainte SQL **et** par le moteur.
- **Mr. White** — la vérification de la devinette est faite côté serveur ; le
  mot attendu ne quitte jamais le serveur avant la fin de la partie.
- **Anti-abus** — `rate_limit_hit()` en SQL, par utilisateur et par action :
  création de room (8/h), join (30/10 min), chat (20/min), réactions (30/min),
  votes, avances de phase, signalements (5/h).
- **Codes de room** — 6 caractères d'un alphabet de 25 symboles sans caractères
  ambigus (≈ 244 M combinaisons) ; les tentatives de join sont limitées.
- **Admin** — double garde : le composant serveur vérifie la session **et** la
  table `admins`, chaque route `/api/admin/*` refait la vérification, et les
  politiques RLS d'écriture du catalogue exigent `is_admin()`.
- **Erreurs** — aucun message PostgreSQL brut n'atteint le joueur : les erreurs
  sont traduites en messages compréhensibles (`lib/api/http.ts`).

### Mode local

L'état de la partie locale n'est **jamais** persisté (ni URL, ni localStorage) :
impossible de revoir un mot via l'historique du navigateur ou un rechargement.
Un écran neutre s'interpose entre deux joueurs, le rôle exige un appui maintenu,
il est remasqué au passage de l'appareil et le texte n'est pas sélectionnable.

**Fenêtre de révélation explicite.** L'écran de rôle ne lit jamais « le joueur
dont c'est le tour » : il lit `revealPlayerId`, une autorisation posée à la
confirmation d'identité et révoquée *avant* que le tour n'avance. Sans cela, le
mot du joueur suivant apparaissait une fraction de seconde pendant l'animation de
transition (l'index de tour avait déjà changé). Même principe pour le vote
hot-seat avec `votePlayerId`. Ces invariants sont couverts par
`features/local-game/__tests__/local-store.test.ts` et par une assertion E2E.

---

## 14. Architecture realtime

**Le serveur reste la source de vérité.** React reflète l'état, il ne le décide
jamais.

```text
Client A ──POST /api/game/vote──▶ Route handler ──▶ moteur ──▶ Postgres
                                                                 │
                                          Realtime postgres_changes
                                                                 ▼
Clients A, B, C ◀── événement ── useRoom() ── relit game_public_state, room_players,
                                              game_player_status, chat_messages
```

- Tables publiées : `rooms`, `room_players`, `games`, `game_player_status`,
  `chat_messages`. `game_players` et `votes` **ne sont pas** publiées.
- Un événement Realtime ne transporte pas les secrets : la RLS filtre les
  lignes, et l'application relit les vues autorisées à chaque notification.
- **Reconnexion** : `useRoom` resynchronise au retour d'onglet, au retour du
  réseau, et via un filet de sécurité toutes les 15 s. Le joueur retrouve sa
  room, son identité, son rôle, son état vivant/éliminé, la phase courante et
  son vote — tout est rechargé depuis le serveur.
- **AFK / minuteurs** : `phase_ends_at` est une échéance absolue. N'importe quel
  client peut appeler `/api/game/tick` ; le serveur revérifie l'échéance et le
  verrou optimiste empêche les doubles avances. Un décalage aléatoire par client
  évite les rafales simultanées.
- **Déconnexion de l'hôte** : à son départ, le plus ancien joueur présent
  devient hôte (`/api/room/leave`), les permissions sont transférées et les
  autres joueurs en sont informés. La room survit à la fermeture du navigateur
  du créateur.

---

## 15. Expiration des rooms

| Événement | Effet |
|---|---|
| Toute action (join, réglages, phase, vote, chat) | `last_activity_at = now()`, `expires_at = now() + 6 h` |
| Lobby inactif > 2 h | statut `expired` |
| Partie inactive > 4 h | statut `expired` |
| `expires_at` dépassé | statut `expired` |
| Room `expired` / `finished` / `cancelled` depuis > 24 h | suppression (cascade sur joueurs, parties, votes, chat, mots personnalisés) |

Appliqué par la fonction SQL `cleanup_rooms()`, appelée par
`GET /api/cron/cleanup` (protégée par `CRON_SECRET`), planifiée toutes les
heures. Les mots personnalisés d'une partie vivent dans la ligne `games` et
disparaissent donc avec la room.

---

## 16. Extensions futures

L'architecture est prête pour ces évolutions, **non développées** en V1 :

- **Comptes et profils** — `profiles` existe déjà et est adossé à `auth.users` ;
  passer d'une session anonyme à un compte ne change ni la RLS ni le moteur.
- **Statistiques, XP, niveaux, classement** — `analytics_events` collecte déjà
  les agrégats anonymes (`game_created`, `game_started`, `game_finished`, mode,
  nombre de joueurs, durée, packs, difficulté, vainqueur).
- **Amis, invitations, historique** — les rooms et les parties sont déjà
  historisées par `room_id` / `game_id`.
- **Nouveaux rôles** — ajouter une entrée dans `ROLE_META` (`lib/game-engine/roles.ts`)
  et sa règle dans `win.ts` ; le reste du moteur, l'UI et le schéma (enum
  `player_role`) suivent sans réécriture.
- **Packs communautaires / génération IA** — le catalogue est déjà
  multi-packs (`packs`, `pack_impostor_words`, `pack_word_pairs`) et administrable.
- **Autres langues** — créer `src/i18n/en.ts` avec les mêmes clés et
  l'enregistrer dans `DICTIONARIES` ; aucun composant n'écrit de texte en dur.
