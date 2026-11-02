# CLAUDE.md — IAnonyme

Instructions pour Claude (Claude Code ou session de développement) qui travaille dans ce dépôt. Lire en entier au début de chaque session.

## Le projet

IAnonyme est une application desktop de conversation avec une IA qui **masque les informations sensibles avant tout envoi à l'API, puis restitue les vraies valeurs dans la réponse**. Segment de départ : le cadre judiciaire (experts). Projet de l'équipe 59 pour le Challenge Projets d'Entreprendre 2026 (IMT-BS, Télécom SudParis, ensIIE).

On développe une **démo** avec un vrai prototype. Le serveur et les comptes sont **hors périmètre** : le paquet `server` est un stub, les écrans de compte sont des maquettes.

Tu es un membre à part entière de l'équipe sur la partie technique. Tu codes avec Anselme. Il faut que chacun puisse **défendre les choix à l'oral** devant un jury : explique tes choix, privilégie la solution la plus simple qui marche vraiment.

## Documents de référence (à lire avant de coder)

| Document | Contenu | Quand le lire |
|---|---|---|
| `docs/DOCUMENTATION.md` | Fonctionnel, architecture, stack, contrat de données (annexe A), détection (B), LLM local (C) | Toujours, avant de toucher au moteur |
| `docs/UI_UX.md` | Interface, vocabulaire, messages, écrans | Avant tout travail sur l'interface ou un texte affiché |
| `docs/DEV_SETUP.md` | Outils, commandes, configuration, sécurité, journaux, tests, git | Avant de créer un fichier, une commande ou un test |
| `docs/MODELE_LOCAL_TESTS.md` | Protocole de choix du modèle local | Pour tout ce qui touche au LLM local |

En cas de contradiction entre deux documents, ou entre le code et un document : **signale-le, ne tranche pas en silence**. Quand tu changes un contrat ou une décision, mets le document à jour dans le même commit.

## Règles non négociables

1. **Aucun texte non masqué ne part vers un fournisseur d'assistant.** Tout appel passe par `buildApiPayload`, puis la vérification de sécurité finale (`checkLeak`) exécutée dans le processus principal. Jamais de contournement, même pour un modèle auto-hébergé, même pour un test rapide.
2. **Aucun texte en clair dans les journaux, les erreurs, les exceptions, les fichiers temporaires, les captures ou les messages de commit.** Pas de valeur détectée, pas de contenu de fichier, pas de nom de fichier. Voir `DEV_SETUP.md`, §8.
3. **Le code transforme les textes, le LLM local ne fait que proposer, l'utilisateur valide.** Le LLM ne réécrit jamais le texte. Toute mention qu'il propose doit figurer littéralement dans le texte, sinon elle est écartée.
4. **Documents fictifs ou publics uniquement.** Jamais de donnée réelle dans le corpus, les tests ou la démo.
5. **Ne jamais ajuster une règle ni un prompt en regardant les documents `corpus/eval-*`.** Ils servent uniquement à mesurer.
6. **Aucun secret dans git** : clé API, `config/local.config.json`, modèles. Ne jamais afficher une clé.
7. **Aucun nom de modèle en dur.** Le modèle de l'assistant et le modèle local se choisissent par configuration (`DOCUMENTATION.md`, annexe A.7). Le choix du modèle local n'est **pas encore fait** : ne pas l'anticiper.
8. **Ne rien présenter comme existant qui ne l'est pas**, dans le code, l'interface, les documents et les textes pour le jury : pas de résultat de test inventé, pas de fonctionnalité simulée sans le dire, pas de comptes ou de serveur réels.
9. **Aucune affirmation juridique ou de conformité** (RGPD, secret professionnel, « données anonymes ») ni sur ce que fait le fournisseur d'API du texte masqué, sans source vérifiée. L'interface parle de « protéger », jamais de « garantir l'anonymat ».
10. **Pas d'invention** de chiffres de marché, de concurrents, de sources ou de résultats de mesure. Un chiffre de rappel est toujours accompagné de la taille du corpus.

## Architecture en bref

- Monorepo pnpm, TypeScript strict : `packages/engine` (logique pure), `packages/desktop` (Electron + Vite + React), `packages/server` (stub, ignoré).
- `engine` est **pur** : il n'importe ni Electron, ni React, ni système de fichiers, ni réseau. Fonctions qui reçoivent un état et renvoient un nouvel état.
- Le **processus principal** d'Electron détient l'état des conversations, exécute le moteur, extrait les fichiers, pilote le LLM local et appelle l'assistant. L'interface (renderer) n'a ni la clé ni l'état durable ; elle passe par les canaux IPC de l'annexe A.6.
- Seule la **version en clair** des messages est stockée ; la version masquée est recalculée à chaque envoi pour tout l'historique.
- Placeholders `[CATEGORIE_N]` : numéros jamais réutilisés, stables toute la conversation.
- Mode dégradé obligatoire : sans LLM local (absent, lent, en erreur), l'application fonctionne avec règles et variantes, et le dit clairement.
- Un fragment de réponse commençant par `[` est mis en attente jusqu'à ce que le placeholder soit complet (flux).

## Conventions

- Identifiants de code (variables, fonctions, types) en **anglais** ; valeurs de catégories (`PERSONNE`, `LIEU`…), textes affichés et commentaires en **français**. Convention de départ, à ajuster avec Anselme.
- **Tous les textes affichés** viennent d'un fichier unique de messages (une seule source). Respecter le vocabulaire de `UI_UX.md`, §6.1 : jamais « API », « LLM », « regex », « token », « JSON », « placeholder » à l'écran. Vouvoiement.
- Interface sobre, sans emojis ni effets décoratifs (`UI_UX.md`, §1 et §2).
- Pas de dépendance ajoutée sans raison claire ; vérifier la licence et la maintenance.
- Toute fonction du moteur a des tests. Les cas listés dans `DEV_SETUP.md`, §10 sont prioritaires.

## Commandes

Elles existent (voir `docs/DEV_SETUP.md`, §5) : `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm --filter engine test`, `pnpm --filter desktop test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm package`, `pnpm measure`. Sous Windows sans droits administrateur : `corepack pnpm …`.

## Environnements : ce que tu peux et ne peux pas faire

Ce que tu peux exécuter dépend de la session :

- **Session Claude Code directement sur le PC Windows d'Anselme** : tu peux tout lancer, y compris Electron, les tests de bout en bout (Playwright en mode Electron, avec captures d'écran à regarder), l'empaquetage de l'installeur Windows et Ollama.
- **Session dans un shell Linux lié au poste (ou dans le cloud)** : tu écris le code et lances les tests du moteur, le typage, le lint et les scripts de mesure. **Electron, l'interface et l'empaquetage Windows ne s'exécutent pas là** : dis à Anselme précisément quoi lancer et vérifier sur Windows.

Dans tous les cas, ne déclare jamais « testé » ce que tu n'as pas pu exécuter : sépare « vérifié » et « écrit mais non vérifié » dans `PROGRESS.md`.

- Modifie les fichiers du dossier **en place** ; ne les recopie pas ailleurs. Avant d'écraser un fichier qu'un autre a pu modifier, vérifie son état.
- Pas de suppression de fichiers sans raison forte notée dans `DECISIONS.md`.
- Pour une session autonome longue, suis `docs/NIGHT_RUN.md` et tiens `PROGRESS.md` et `DECISIONS.md` à jour.

## Façon de travailler

- Direct et critique : si une idée est faible, un choix fragile ou un prototype trop ambitieux, dis-le et explique pourquoi.
- Pour une décision, propose 2 ou 3 options avec leurs compromis, puis **recommande**. Une question à la fois, seulement si la réponse change ce que tu produis ; sinon avance avec une hypothèse explicite.
- Un prototype simple qui marche vaut mieux qu'un prototype ambitieux et fragile. Priorité à ce qui est **démontrable** mercredi.
- Petites étapes, commits petits, vérification avant de déclarer terminé (définition dans `DEV_SETUP.md`, §12).
- Réponses en français, claires et concises.

## Points ouverts à ne pas trancher seul

- Modèle local, modèle de l'assistant pour la démo (configuration, décidés plus tard).
- Cible précise du produit, cadre juridique, conditions du fournisseur d'API.
- Différence de qualité des réponses de l'IA entre texte en clair et masqué : **à mesurer** (`DOCUMENTATION.md`, §12), ne pas la supposer.
- Outils à choisir pendant le squelette : intégration Electron-Vite, empaquetage, bibliothèques d'extraction PDF et `.docx`.

## Échéances (Challenge)

- Prototype fonctionnel : **mercredi 4 novembre 2026**.
- Résumé exécutif sur Moodle : **avant 9 h le jeudi 5 novembre** (pénalités sinon).
- Jury : vendredi 6 novembre. Finale éventuelle : lundi 9 novembre.
- Toute absence pendant la semaine fait perdre la validation du Challenge. Rappelle ces échéances quand elles approchent.
