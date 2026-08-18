# GeoRush

GeoRush est le quiz de géographie en ligne de FlexGames (2 à 12 joueurs). Une partie contient 10, 15 ou 30 questions de 10, 15 ou 20 secondes. La vitesse, puis les séries de bonnes réponses, déterminent le score.

## Gameplay et types de questions

Le générateur mélange six variantes : pays sur carte → capitale, pays sur carte, drapeau → pays, pays → capitale, capitale → pays et silhouette → pays. Les cartes et silhouettes sont rendues en SVG depuis le même TopoJSON Natural Earth. Les QCM ont quatre choix ; les réponses libres sont normalisées sans IA (casse, accents, ponctuation et espaces).

Le preset « Mix complet » répartit les six variantes en cycles mélangés. Un pays n'est pas repris avant épuisement du pool. Les distracteurs privilégient la même région et le même niveau de difficulté.

## Dataset et difficulté

`data/countries.ts` construit un catalogue statique d'États souverains à partir de `world-countries` 5.1.0 : code ISO, nom français, capitale, région, niveau et alias. Les territoires dépendants sont exclus. `world-atlas` 2.0.2 fournit les frontières Natural Earth 1:50m ; `flag-icons` 7.5.0 fournit les drapeaux SVG locaux.

- Facile : pays mondialement connus.
- Normal : pool facile + pays intermédiaires.
- Difficile : presque tous les États souverains du catalogue.

Pour modifier les pools, éditer `EASY` et `NORMAL` dans `data/countries.ts` ; les autres pays deviennent difficiles. Le test `validateGeoDataset()` détecte les ISO, capitales, régions, difficultés, géométries, doublons et noms français invalides.

## Architecture, temps réel et sécurité

Le serveur génère toute la séquence avec une seed liée à la session. `geo_sessions` garde les questions et corrigés dans un JSONB sans policy cliente. `geo_answers` stocke une réponse officielle unique par joueur et par round. `game_sessions.state` ne contient que la projection publique diffusée par le Realtime FlexGames existant : phase, deadline, question sans corrigé, nombre de réponses, révélation et classement.

Les transitions sont une machine d'état `countdown → question → reveal → leaderboard éventuel → results`. Toute deadline, validation, série et attribution de points utilise l'heure serveur. La fonction SQL `geo_commit_state` publie atomiquement état privé et état public avec verrou de version optimiste. La contrainte unique de `geo_answers` rend les doubles envois idempotents. Au rechargement, le snapshot public restaure la phase et l'endpoint privé restaure le verrou de réponse du joueur.

Score : `350 + round(650 × temps_restant / durée)`, puis bonus limité à +50 (série 3), +100 (série 4) ou +150 (série 5+). Une erreur rapporte 0 et remet la série à zéro.

## Ajouter un type de question

1. Ajouter la variante discriminée dans `GeoPublicQuestion` (`types.ts`).
2. L'ajouter à `GEO_QUESTION_TYPES` et à l'unique dispatcher `makeQuestion()` (`engine/questions.ts`).
3. Ajouter son visuel dans `QuestionVisual` si le renderer existant ne suffit pas.
4. Compléter les tests de génération et vérifier que le corrigé reste absent de `toPublicGeoState()`.
