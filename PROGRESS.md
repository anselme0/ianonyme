# PROGRESS.md — Avancement de la session autonome

> Tenu à jour par Claude pendant la session (voir `NIGHT_RUN.md` §3.3). Ne jamais cocher ce qui n'a pas été exécuté.

## Résumé pour le matin

- **État** : le périmètre de `docs/NIGHT_RUN.md` §5 est fait (niveaux 0 à 6, passe finale, deuxième passe), sur la branche `dev/nuit` (aucun envoi vers `origin`). Tags `checkpoint-0` à `checkpoint-6`.
- **Ce qui marche, vérifié** : moteur (149 tests), application Electron (105 tests + 13 tests de bout en bout avec captures regardées), parcours de démonstration complet avec l'assistant de démonstration hors ligne, application empaquetée et contenu de l'installeur qui démarrent, module natif `node-llama-cpp` qui se charge.
- **Ce qui est simulé** : l'assistant (« Assistant de démonstration (hors ligne) ») et l'analyse approfondie (« simulée ») : voir `docs/DEMO_SCRIPT.md` §1 pour ce qu'il faut dire au jury.
- **Ce qui n'est pas vérifié** : appel réel à Claude (pas de clé), vrai modèle local (Ollama et GPU laissés à vos tests), installation de l'installeur sur un poste propre.
- **Lancer** : `corepack pnpm install`, puis `corepack pnpm dev` (développement) ou l'installeur `packages/desktop/release/IAnonyme Setup 0.1.0.exe`.
- **À regarder en premier** : (1) lancer le parcours de `docs/DEMO_SCRIPT.md` ; (2) installer l'installeur sur un profil propre ; (3) lire « Questions pour le matin » ci-dessous ; (4) `reports/measure.json` : les mentions indirectes sont à 0 % sans modèle, c'est normal et affiché tel quel.
- **Mesure** : sur 6 documents fictifs, 95 % des valeurs directes repérées sur les documents d'ajustement, 88 % sur ceux d'évaluation (ORGANISATION : 40 % en évaluation, non ajusté, règle 5). Corpus minuscule : aucun pourcentage n'est représentatif.
- **Plages de charge** à écarter de vos mesures de latence : voir « Environnement » (builds et tests de bout en bout, un à deux processus à la fois).


## Prochaine action

Niveau 6 : écrire `docs/PROMPTS.md` et `docs/DEMO_SCRIPT.md`, puis passe finale (audit adverse), puis deuxième passe.

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
- [ ] Corpus complété (`.docx`, PDF réalistes) : reporté volontairement (D7), les documents sont dans `demo/

### Niveau 3 : Electron et services
- [x] Processus principal, état des conversations, IPC (A.6)
- [x] Sécurité Electron (`DEV_SETUP.md` §7), journaux sans texte en clair
- [x] Extraction `.txt`, `.docx`, PDF et cas de blocage
- [x] Fournisseurs : `anthropic`, `openai-compatible`, faux fournisseur
- [x] Streaming avec restauration
- [x] LLM local derrière `proposeMentions`, mode dégradé

### Niveau 4 : interface, première passe
- [x] Tokens de couleur et de typographie (clair, sombre)
- [x] Écran principal : conversation, saisie avec surlignage, volet Protection
- [x] « Ce que l'IA va recevoir »
- [x] Revue plein écran
- [x] Restitution visible dans les réponses
- [x] Envoi bloqué
- [x] Écran « Fiabilité de la détection »

### Niveau 5 : vérification de bout en bout
- [x] Tests de bout en bout Electron avec captures regardées
- [x] Parcours de démonstration complet avec le faux fournisseur
- [x] Cinq tours avec placeholders cohérents

### Niveau 6 : démonstration et empaquetage
- [x] `PROMPTS.md`
- [x] `DEMO_SCRIPT.md`
- [x] Rapport d'expertise fictif `.docx` et PDF
- [x] Installeur Windows construit et lancé

### Passe finale
- [x] Réorganisation finale du code et du dossier, chemins et documents à jour
- [x] Audit adverse de la protection (chaque fuite trouvée devient un test)
- [x] `git status` propre : aucun secret, modèle ni journal
- [x] Documents à jour, « Résumé pour le matin » écrit

### Deuxième passe (après tout le reste)
- [x] Revue courte en ligne
- [x] Modèles de tâches dans l'interface
- [x] Renommage et suppression de conversations
- [x] Écran de démarrage
- [x] Paramètres complets

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
- Contournement : cible `dir` (`win-unpacked`), puis NSIS via une console masquée (voir ci-dessous).
Construction de l'installeur (plages à écarter des mesures de latence d'Anselme) : essais de build vers 23 h 50 à 23 h 56 (spike, dossier jetable), build de l'application vers 00 h 41 à 00 h 43 (heure locale, nuit du 2 au 3 nov.).
`pnpm package` depuis les outils de la session échoue sur `makensis` (`ENOTCONN`) ; contourné en lançant `cmd /c` dans une fenêtre masquée (console réelle). Dans un terminal ordinaire, la commande normale devrait marcher.


## Réorganisations

- 3 nov. 2026 (début de session) : documents -> `docs/`, logos -> `assets/logo/`, `README.md` créé. Fait avec `git mv`.

## Vérifié

Commandes lancées dans la nuit du 2 au 3 novembre 2026 et résultat obtenu :

- `pnpm typecheck`, `pnpm lint` : passent.
- `pnpm --filter engine test` : 149 tests (masquage, cohérence, historique, anti-fuite, restitution et flux coupé à chaque position, une et deux coupures, conflits, mentions du LLM, erreurs sans valeur, corpus d'ajustement, audit adverse : casse, accents, espaces et caractères invisibles Unicode, lettres cyrilliques identiques, formats de téléphone et d'IBAN, performance sur de longs textes).
- `pnpm --filter desktop test` : 105 tests (service de conversation avec faux fournisseur, cinq tours, envoi bloqué sans appel du fournisseur, extraction `.txt`/`.docx`/PDF, fournisseurs `anthropic` et `openai-compatible` contre un faux serveur local, journal sans texte, rendu des réponses restituées, vocabulaire, source unique des textes, contrastes AA des deux thèmes).
- `pnpm measure` : écrit `reports/measure.json` (règles et variantes seules).
- `pnpm --filter desktop test:e2e` : 13 tests Electron passent (parcours de démonstration complet, sécurité de la fenêtre, journaux sans valeur, analyse de base, fichiers refusés, thème sombre, conversations, application empaquetée, revue en ligne, écran de démarrage, à propos). Les captures de `packages/desktop/e2e/screenshots/` ont été regardées (revue, comparaison, réponse restituée, envoi bloqué, fiabilité, analyse de base, thème sombre).
- Application empaquetée (`release/win-unpacked`) et contenu extrait de l'installeur NSIS : démarrent, le module natif de `node-llama-cpp` se charge (CPU seul), un envoi complet passe, les outils de développement sont inactifs.
- `pnpm dev` (electron-vite) : démarre sans erreur.

## Écrit mais non vérifié

- Fournisseur `anthropic` contre le vrai service : aucune clé cette nuit (testé contre un faux serveur seulement).
- `node-llama-cpp` avec un vrai modèle : chargement, grammaire JSON, téléchargement avec empreinte (`downloadModel`) écrits, jamais exécutés (Ollama et GPU réservés aux tests d'Anselme, aucun modèle téléchargé).
- Installeur NSIS : construit (180 Mo) mais pas installé sur le poste (écrit dans le registre) ; seul son contenu extrait a été lancé. À essayer par Anselme : `packages/desktop/release/IAnonyme Setup 0.1.0.exe`.
- Latences de l'analyse approfondie réelle : non mesurées.
- Rendu visuel de l'interface seulement dans Chromium d'Electron sur cet écran (1400 x 900) ; pas testé sur petit écran, ni avec une mise à l'échelle Windows.

## Problèmes connus

- **`makensis` : `ENOTCONN`** quand `electron-builder` est lancé depuis les outils de la session (essayé : Bash, PowerShell, entrée standard redirigée, `Start-Process` avec redirections ; contourné par `cmd /c` dans une fenêtre masquée). À relancer dans un terminal ordinaire.
- **Organisations en évaluation : 40 %** (2 sur 5). Non ajusté : les documents `eval-*` ne servent qu'à mesurer (règle 5). À reprendre avec de nouveaux documents d'ajustement si l'équipe le souhaite.
- **Mentions indirectes : 0 %** sans analyse approfondie ; l'indicateur de gain n'est pas mesuré tant que le modèle n'est pas choisi.
- **Limites de la détection (testées comme telles)** : lettres espacées (`J e a n`), encodage de pourcentage, ligatures `œ` et `æ`, noms de lieux (LIEU : LLM seulement, annexe B.1), personnes sans civilité ni prénom connu (ex. « garnier » seul dans une phrase, tant qu'aucune entité ne le porte).
- **PDF** : l'ordre du texte de pdf.js peut mélanger des colonnes ; les images intégrées d'un PDF ne sont pas détectées (le `.docx` le fait). Un PDF mal construit peut sortir sans avertissement.
- **Revue des messages** : l'avertissement « repère altéré » est au niveau du message, pas du passage.
- **Pastille de fichier** : le nom affiché est le nom envoyé (mots rares remplacés par « … ») ; l'utilisateur ne peut pas le modifier.
- **Tests de bout en bout** : lancés à une taille de fenêtre (1400 x 900) ; pas de test petit écran ni mise à l'échelle Windows.
- **Journaux** : le processus principal écrit sur la sortie d'erreur (codes et nombres seulement, test à l'appui) ; aucun fichier de journal n'est créé.
- **`pnpm corepack enable`** exige l'administrateur sous Windows : utiliser `corepack pnpm …`.

## Questions pour le matin

1. **Modèle local et modèle de l'assistant** : non choisis (règle 7). Le moteur `node-llama-cpp` est branché par configuration (`localModel`), mais jamais essayé avec un vrai modèle : à tester dès que les résultats Ollama sont arrêtés.
2. **Liste de prénoms** (`packages/engine/src/names.ts`, environ 400) : écrite à la main, sans source ; à relire ou à remplacer par une source citée.
3. **« Analyse approfondie simulée »** : accepter que la démonstration hors ligne affiche cette mention (c'est la lecture prudente de la règle 8), ou prévoir la configuration réelle (clé + modèle) avant le jury ?
4. **Compte maquette** : aucune mention « maquette » à l'écran (`docs/UI_UX.md` §12, choisi au départ). Le dire à l'oral, avec le schéma « prototype vs produit ».
5. **Corpus** : aucun document ajouté dans `corpus/` pendant la nuit (vos tests le parcourent). Les documents de démonstration sont dans `demo/` ; à intégrer au corpus après vos tests si utile (formats `.docx` et PDF avec annotations).
6. **Taille maximale de fichier** : 10 Mo par défaut (`limits.maxFileBytes`), à fixer après les tests.
7. **Mots-clés d'organisation** : « tribunal » figure dans `docs/DOCUMENTATION.md` B.1 mais les juridictions publiques ne sont pas masquées (B.3) ; j'ai suivi B.3 (voir `DECISIONS.md`). Confirmer.

## Réorganisations (suite)

- Fin du niveau 1, 3 et 4 : relues, pas de déplacement nécessaire (moteur et application déjà séparés ; scripts rangés dans `packages/*/scripts`).
- Passe finale : suppression d'un script de debug ; `README.md` et `docs/DEV_SETUP.md` §4 mis à jour avec l'arborescence réelle.
