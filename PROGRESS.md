# PROGRESS.md — Avancement de la session autonome

> Tenu à jour par Claude pendant la session (voir `NIGHT_RUN.md` §3.3). Ne jamais cocher ce qui n'a pas été exécuté.

## Résumé pour le matin

_(à remplir à la fin ; en attendant, état en 10 lignes maximum)_

- Statut : pas démarré.

## Prochaine action

Lire `CLAUDE.md`, `NIGHT_RUN.md`, puis poser les questions de la phase 0.

## Décisions de départ (réponses à la phase 0)

_(à remplir)_

## Backlog

### Niveau 0 : environnement, organisation, squelette
- [ ] 0.A Vérification de l'installation (Node, pnpm, Electron, Playwright, `node-llama-cpp`, build d'installeur) ; section « Environnement » remplie
- [ ] 0.B Réorganisation du dossier (documents, logos, `README.md`), chemins mis à jour
- [ ] Dépôt git : vérifier `.gitignore`, `.gitattributes`, `.editorconfig` et commiter les documents
- [ ] Monorepo pnpm (`engine`, `desktop`, `server` stub), TypeScript strict
- [ ] Vitest, ESLint, Prettier ; `typecheck`, `lint`, `test` passent
- [ ] `config/local.config.example.json`

### Niveau 1 : moteur
- [ ] Types et contrat (annexe A.1, A.2)
- [ ] Masquage (A.4), déterminisme, normalisation
- [ ] Détection déterministe (annexe B.1) et propagation des variantes (B.2), conflits
- [ ] Décisions utilisateur (accepter, rejeter, relier, ajouter)
- [ ] `checkLeak`
- [ ] `restore` et restaurateur en flux (test à chaque position de coupure)
- [ ] `buildApiPayload` (re-masquage de l'historique) et `requiresReview`
- [ ] `mergeLlmMentions` (annexe C.5) avec faux LLM
- [ ] Tests de `DEV_SETUP.md` §10 (y compris : aucune valeur dans les erreurs)

### Niveau 2 : mesure
- [ ] `pnpm measure` sur le moteur TypeScript
- [ ] Sortie JSON pour l'écran « Fiabilité de la détection »
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

_(à remplir à l'étape 0.A : outils, versions, ce qui marche, ce qui ne marche pas, contournements)_

## Réorganisations

_(date, ce qui a bougé, commit)_

## Vérifié

_(commande lancée → résultat obtenu)_

## Écrit mais non vérifié

_(ce que je n'ai pas pu exécuter ou regarder, et pourquoi)_

## Problèmes connus

_(ce qui a été essayé, ce qui reste)_

## Questions pour le matin

_(points qui demandent l'équipe ; la session a continué avec un choix par défaut)_
