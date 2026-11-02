# PROGRESS.md — Avancement de la session autonome

> Tenu à jour par Claude pendant la session (voir `NIGHT_RUN.md` §3.3). Ne jamais cocher ce qui n'a pas été exécuté.

## Résumé pour le matin

_(à remplir à la fin ; en attendant, état en 10 lignes maximum)_

- Statut : niveaux 0 à 2 faits (squelette, moteur, mesure). Niveau 3 en cours.

## Prochaine action

Niveau 3 : créer `packages/desktop` (electron-vite), processus principal, IPC, fournisseurs, extraction.

## Décisions de départ (réponses à la phase 0)

- Clé API Claude : non. Faux fournisseur pour tout ; fournisseur Claude testé contre un faux serveur seulement.
- Ollama et GPU : ne rien toucher ; `proposeMentions` testé avec un faux LLM.
- Installations dans le projet autorisées. Empaquetage Windows tenté après le niveau 3.
- Polices : IBM Plex via `@fontsource` (embarquées).
- Git : branche `dev/nuit` depuis `main`, aucun push.
- Périmètre : niveaux 0 à 6, passe finale, puis deuxième passe. Pas d'heure limite. Pas de notification.
- Aucune autre zone protégée que le §6 de `docs/NIGHT_RUN.md`. Projet hors OneDrive, emplacement inchangé.
- Compte maquette : défauts fictifs, aucune mention « maquette » à l'écran (suit `docs/UI_UX.md` §12).

## Backlog

### Niveau 0 : environnement, organisation, squelette
- [x] 0.A Vérification de l'installation (Node, pnpm, Electron, Playwright, `node-llama-cpp`, build d'installeur) ; section « Environnement » remplie
- [x] 0.B Réorganisation du dossier (documents, logos, `README.md`), chemins mis à jour
- [x] Dépôt git : vérifier `.gitignore`, `.gitattributes`, `.editorconfig` et commiter les documents
- [x] Monorepo pnpm (`engine`, `desktop`, `server` stub), TypeScript strict
- [x] Vitest, ESLint, Prettier ; `typecheck`, `lint`, `test` passent
- [x] `config/local.config.example.json`

### Niveau 1 : moteur
- [x] Types et contrat (annexe A.1, A.2)
- [x] Masquage (A.4), déterminisme, normalisation
- [x] Détection déterministe (annexe B.1) et propagation des variantes (B.2), conflits
- [x] Décisions utilisateur (accepter, rejeter, relier, ajouter)
- [x] `checkLeak`
- [x] `restore` et restaurateur en flux (test à chaque position de coupure)
- [x] `buildApiPayload` (re-masquage de l'historique) et `requiresReview`
- [x] `mergeLlmMentions` (annexe C.5) avec faux LLM
- [x] Tests de `DEV_SETUP.md` §10 (y compris : aucune valeur dans les erreurs)

### Niveau 2 : mesure
- [x] `pnpm measure` sur le moteur TypeScript
- [x] Sortie JSON pour l'écran « Fiabilité de la détection »
- [ ] Corpus complété (`.docx`, PDF réalistes) si utile

### Niveau 3 : Electron et services
- [ ] Processus principal, état des conversations, IPC (A.6)
- [ ] Sécurité Electron (`DEV_SETUP.md` §7), journaux sans texte en clair
- [ ] Extraction `.txt`, `.docx`, PDF et cas de blocage
- [ ] Fournisseurs : `anthropic`, `openai-compatible`, faux fournisseur
- [ ] Streaming avec restauration
- [ ] LLM local derrière `proposeMentions`, mode dégradé

### Niveau 4 : interface, première passe
- [ ] Tokens de couleur et de typographie (clair, sombre)
- [ ] Écran principal : conversation, saisie avec surlignage, volet Protection
- [ ] « Ce que l'IA va recevoir »
- [ ] Revue plein écran
- [ ] Restitution visible dans les réponses
- [ ] Envoi bloqué
- [ ] Écran « Fiabilité de la détection »

### Niveau 5 : vérification de bout en bout
- [ ] Tests de bout en bout Electron avec captures regardées
- [ ] Parcours de démonstration complet avec le faux fournisseur
- [ ] Cinq tours avec placeholders cohérents

### Niveau 6 : démonstration et empaquetage
- [ ] `PROMPTS.md`
- [ ] `DEMO_SCRIPT.md`
- [ ] Rapport d'expertise fictif `.docx` et PDF
- [ ] Installeur Windows construit et lancé

### Passe finale
- [ ] Réorganisation finale du code et du dossier, chemins et documents à jour
- [ ] Audit adverse de la protection (chaque fuite trouvée devient un test)
- [ ] `git status` propre : aucun secret, modèle ni journal
- [ ] Documents à jour, « Résumé pour le matin » écrit

### Deuxième passe (après tout le reste)
- [ ] Revue courte en ligne
- [ ] Modèles de tâches dans l'interface
- [ ] Renommage et suppression de conversations
- [ ] Écran de démarrage
- [ ] Paramètres complets

## Environnement

Mesuré le 2 nov. 2026 (Windows 11, Node 24.18.0, npm 11.16.0, git 2.45.1, Python 3.12.10, 466 Go libres, projet hors OneDrive).

Marche (dans un espace jetable) :
- pnpm via `corepack pnpm` (pnpm 12.16.1). `corepack enable` échoue (EPERM, droits administrateur) : utiliser `corepack pnpm ...` ou `npm i -g pnpm`.
- pnpm 12 bloque les scripts d'installation : à autoriser explicitement (`onlyBuiltDependencies`). Le binaire d'Electron se télécharge au premier lancement.
- Electron 45.2.1 : fenêtre lancée. Playwright 1.64 en mode Electron : titre lu, capture produite (sans navigateurs Playwright).
- `node-llama-cpp` 3.22.2 : module natif chargé (CPU seul, `build: 'never'`).
- electron-builder 26.18 : construit `win-unpacked`. Le paquet `node-llama-cpp` embarque tous les binaires (CUDA, Vulkan) : l'archive de l'installeur fait ~400 Mo avant élagage.

Ne marche pas :
- Cible NSIS : `Error: read ENOTCONN` au lancement de `makensis`, depuis les outils de la session (Bash et PowerShell, entrée standard redirigée ou non). Probablement lié à la gestion des tubes par l'environnement de la session. À essayer dans un terminal ordinaire : `pnpm package`.
- Contournement : cible `dir` (`win-unpacked`) et archive zip.

## Réorganisations

- 3 nov. 2026 (début de session) : documents -> `docs/`, logos -> `assets/logo/`, `README.md` créé. Fait avec `git mv`.

## Vérifié

- `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (moteur : 98 tests, 7 fichiers) : passent (2 nov. 2026, 00 h 11).
- `pnpm measure` : produit `reports/measure.json` (règles et variantes seules ; analyse approfondie non mesurée).
- Spike Electron + Playwright + `node-llama-cpp` + `electron-builder --dir` dans un dossier jetable : voir « Environnement ».

## Écrit mais non vérifié

- Cible d'installeur NSIS (`ENOTCONN` depuis les outils de la session).

## Problèmes connus

_(ce qui a été essayé, ce qui reste)_

## Questions pour le matin

_(points qui demandent l'équipe ; la session a continué avec un choix par défaut)_
