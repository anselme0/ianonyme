# IAnonyme — Mise en place de l'environnement de développement

> Complète `DOCUMENTATION.md` (fonctionnel, technique), `UI_UX.md` (interface) et `MODELE_LOCAL_TESTS.md` (choix du modèle local).
> Objectif : que n'importe qui de l'équipe, ou une session de Claude, puisse cloner le dépôt, lancer l'application, lancer les tests et empaqueter la démo sans poser de question.
> Ce document décrit un cadre à suivre. Les outils marqués « à choisir » sont tranchés pendant le squelette du dépôt et les spikes (`DOCUMENTATION.md`, §15), puis ce document est mis à jour.

## Table des matières

1. [Qui travaille comment](#1-qui-travaille-comment)
2. [Prérequis](#2-prérequis)
3. [Création du dépôt](#3-création-du-dépôt)
4. [Structure et outils](#4-structure-et-outils)
5. [Commandes](#5-commandes)
6. [Configuration et secrets](#6-configuration-et-secrets)
7. [Sécurité de l'application Electron](#7-sécurité-de-lapplication-electron)
8. [Journalisation : jamais de texte en clair](#8-journalisation--jamais-de-texte-en-clair)
9. [Données de test](#9-données-de-test)
10. [Tests](#10-tests)
11. [Workflow git](#11-workflow-git)
12. [Définition de « terminé »](#12-définition-de--terminé-)
13. [Empaquetage et machine de démonstration](#13-empaquetage-et-machine-de-démonstration)
14. [Ordre de départ](#14-ordre-de-départ)

---

## 1. Qui travaille comment

Le code est développé à deux : **Anselme** et **Claude**, qui est un membre à part entière de l'équipe sur la partie technique. Le travail se partage entre trois environnements, et il faut savoir qui peut exécuter quoi.

| Environnement | Ce qu'on y fait | Limites |
|---|---|---|
| **Poste d'Anselme (Windows)** | Lancer l'application Electron, tester l'interface, empaqueter l'installeur, faire tourner Ollama et le LLM local, mesurer les temps et la mémoire, tester sur la machine de démo | Seul endroit où l'application complète tourne |
| **Session de Claude, poste d'Anselme (shell Linux, dossier du projet monté)** | Écrire et modifier le code, lancer les tests du moteur, les scripts de mesure, le typage, le lint | Linux : **pas d'Electron, pas d'interface, pas d'empaquetage Windows**. Pas de GPU. |
| **Session de Claude, cloud** | Recherche, prototypage, travail sur des copies | Ne voit pas le dossier du projet sans transfert |

Conséquences :

- Le paquet `engine` ne dépend ni d'Electron ni de React (`DOCUMENTATION.md`, §5) : c'est ce qui permet de **le tester partout**. La plus grande partie de la logique critique doit vivre là.
- Tout ce qui touche à Electron, à l'interface ou à l'empaquetage est vérifié par Anselme sur Windows. Claude écrit le code, indique précisément quoi vérifier et avec quelle commande.
- Un fichier modifié par l'un doit être relu par l'autre avant fusion sur `main` quand il touche au contrat du moteur (annexe A) ou à la protection des données (§7 et §8 ci-dessous).

## 2. Prérequis

| Outil | Version | Remarque |
|---|---|---|
| Node.js | Version LTS, **fixée dans `.nvmrc` et dans `engines` de `package.json`** | À figer à la création du squelette. Le shell Linux de Claude fournit actuellement Node 22. |
| pnpm | Via Corepack (`corepack enable`), version fixée dans `packageManager` | Absent du shell Linux de Claude à ce jour : à installer (réseau à vérifier) |
| Git | Récent | Fin de ligne : voir §3 |
| Python 3 | 3.10 ou plus | Uniquement pour `scripts/*.py` (banc d'essai provisoire du modèle local) |
| Ollama | Récent | Développement et comparaison du LLM local ; pas nécessaire pour l'application |
| Windows 10 ou 11 | | Plateforme de la démo |
| Outils de compilation C++ | À vérifier au spike | `node-llama-cpp` fournit normalement des binaires précompilés ; une compilation locale peut être nécessaire selon la machine |

Éditeur : libre (le dossier contient `.idea`, donc un IDE JetBrains est utilisé ; ce dossier est ignoré par git, voir §3).

## 3. Création du dépôt

Le dépôt git existe (branche `main`, commit initial, `.gitignore`, `.gitattributes` et `.editorconfig` déjà en place). Le contenu de référence de ces fichiers est donné ci-dessous : à utiliser pour vérifier ou compléter, pas pour les refaire.

Fichiers de référence :

**`.gitignore`**

```
node_modules/
dist/
out/
release/
.idea/
.vscode/
*.log

# Secrets et configuration locale
config/local.config.json
.env
.env.*
!.env.example

# Modèles locaux (volumineux, téléchargés au premier lancement)
models/
*.gguf

# Résultats temporaires du banc d'essai
scripts/results/*.log
```

Les résultats JSON du banc d'essai (`scripts/results/*.json`) sont **versionnés** : ils documentent le choix du modèle.

**`.gitattributes`** (le projet est développé sous Windows et Linux)

```
* text=auto eol=lf
```

**`.editorconfig`** : UTF-8, fins de ligne `lf`, indentation de 2 espaces pour TypeScript et JSON.

Le premier commit contient uniquement les documents, le corpus et les scripts existants. Le squelette du code vient dans un commit séparé.

## 4. Structure et outils

Structure cible (voir `DOCUMENTATION.md`, §5) :

```
ianonyme/
├── packages/
│   ├── engine/          # détection, masquage, restauration, anti-fuite (TypeScript pur)
│   ├── desktop/         # Electron (main, preload) + interface Vite + React
│   └── server/          # STUB, ignoré pour la démo
├── config/
│   ├── local.config.example.json   # versionné, sans secret
│   └── local.config.json           # hors dépôt (clé API)
├── corpus/              # documents fictifs + annotations
├── scripts/             # mesure et banc d'essai
├── DOCUMENTATION.md
├── UI_UX.md
├── MODELE_LOCAL_TESTS.md
├── DEV_SETUP.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Outils : ce qui est décidé, et ce qui reste à choisir.

| Sujet | État | Choix |
|---|---|---|
| Langage | Décidé | TypeScript, mode `strict` partout |
| Gestionnaire | Décidé | pnpm, monorepo |
| Application desktop | Décidé | Electron |
| Interface | Décidé | Vite + React |
| Tests | Proposé | Vitest (déjà dans l'écosystème Vite) |
| Qualité du code | Proposé | ESLint et Prettier, configuration partagée à la racine |
| Intégration Electron et Vite | À choisir au squelette | Un outil existant du type `electron-vite`, à comparer à une configuration manuelle |
| Empaquetage Windows | À choisir pendant le spike 1 | `electron-builder` ou Electron Forge : retenir celui qui empaquette `node-llama-cpp` sans difficulté |
| Extraction PDF et `.docx` | À choisir pendant les spikes | Bibliothèques à comparer sur des documents réalistes |
| Bibliothèque de composants et d'icônes | À choisir avec l'interface | `UI_UX.md`, §2.5 : icônes en trait fin (Lucide ou Phosphor) |

Règle de dépendances : `engine` n'importe ni `electron` ni `react` ni module Node spécifique à la plateforme (système de fichiers, réseau). Il reçoit et renvoie des données. Les accès au système (fichiers, LLM, API) sont dans `desktop` (processus principal).

## 5. Commandes

À créer avec le squelette. Noms visés :

| Commande | Rôle |
|---|---|
| `pnpm install` | Installer les dépendances |
| `pnpm dev` | Lancer l'application en développement (Windows) |
| `pnpm test` | Tous les tests |
| `pnpm --filter engine test` | Tests du moteur seuls (utilisables sous Linux) |
| `pnpm typecheck` | Vérification des types, tous paquets |
| `pnpm lint` | ESLint |
| `pnpm build` | Compilation |
| `pnpm package` | Installeur Windows |
| `pnpm measure` | Script de mesure du rappel sur le corpus (réutilise `engine`) |

## 6. Configuration et secrets

- La configuration locale est `config/local.config.json`, **jamais versionnée**. Elle contient la clé API et la sélection des fournisseurs et des modèles. Sa structure est décrite dans `DOCUMENTATION.md`, annexe A.7. `config/local.config.example.json` est le seul fichier versionné.
- L'application **n'affiche jamais** la clé. Elle n'est lue que par le processus principal d'Electron.
- La clé de démonstration a un **plafond de dépense** fixé côté compte et est **révoquée après la finale**.
- Ne jamais coller une clé dans une conversation, un commit, un message d'erreur ou une capture d'écran. Si une clé fuite : la révoquer immédiatement, puis en créer une autre.
- Les modèles locaux (fichiers `.gguf`) ne sont pas dans git. Ils sont téléchargés au premier lancement avec vérification d'empreinte (`sha256` de l'entrée du registre).
- Le choix du modèle (assistant et LLM local) se fait **uniquement par configuration**. Aucun nom de modèle écrit en dur dans le code.

## 7. Sécurité de l'application Electron

Une application qui promet de protéger des données ne doit pas fuir par ses propres défauts. Réglages à appliquer dès le squelette :

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` pour toutes les fenêtres.
- Le script `preload` n'expose qu'une API **minimale et typée** (les canaux de `DOCUMENTATION.md`, annexe A.6). Jamais d'accès générique au système de fichiers ou au réseau depuis l'interface.
- **Politique de sécurité de contenu (CSP)** restrictive : pas de scripts ni de ressources distantes. Les polices et les icônes sont **embarquées** (`UI_UX.md`, §2.3).
- Aucune navigation vers une adresse externe dans l'application ; les liens ouvrent le navigateur du système après action explicite.
- Aucun contenu distant chargé (ni analytique, ni polices distantes, ni mises à jour automatiques).
- Outils de développement désactivés dans l'installeur.
- La clé API et les appels à l'assistant restent dans le **processus principal**. L'interface n'a jamais la clé.
- La **vérification de sécurité finale** (anti-fuite) est exécutée dans le processus principal, juste avant l'appel au fournisseur (`DOCUMENTATION.md`, A.6). Une erreur d'interface ne doit pas pouvoir la contourner.

## 8. Journalisation : jamais de texte en clair

Règle absolue : **aucun texte saisi ou importé, aucune valeur détectée, aucun placeholder associé à sa valeur, aucun contenu de fichier ni nom de fichier ne doit apparaître dans un journal, un message d'erreur, une exception remontée à l'interface, un rapport de plantage ou un fichier temporaire.**

- Les journaux n'ont que des informations techniques : nombres d'éléments, durées, codes d'erreur, nom du module.
- Les messages d'erreur remontés à l'utilisateur sont ceux de `UI_UX.md`, §6.2. Jamais une trace brute contenant des données.
- Les rapports de plantage automatiques sont désactivés.
- Les fichiers importés ne sont pas copiés sur le disque : le texte extrait reste en mémoire, et la table de correspondance aussi (`DOCUMENTATION.md`, §10).
- Les exceptions du moteur ne contiennent pas les valeurs : un test vérifie qu'un message d'erreur ne contient pas une valeur de test connue.
- Pendant la démonstration, la console de développement n'est pas ouverte.
- Les journaux du banc d'essai Python (`scripts/results/*.log`) peuvent contenir des sorties de modèle sur le corpus fictif : ils sont ignorés par git et ne servent qu'à l'investigation locale.

## 9. Données de test

- **Documents fictifs ou publics uniquement**, partout : tests, banc d'essai, démonstration. Jamais de document réel, même « anonymisé à la main ».
- Corpus actuel : `corpus/ajust-*.txt` (ajustement des règles et du prompt) et `corpus/eval-*.txt` (évaluation). **Ne jamais ajuster une règle ni le prompt en regardant les documents `eval-*`** : c'est ce qui rend la mesure honnête (`DOCUMENTATION.md`, §12).
- Chaque document a un fichier `<nom>.annotations.json` (format décrit en §12 de `DOCUMENTATION.md`).
- À ajouter : un rapport d'expertise fictif réaliste en `.docx` et en PDF, plus long que les documents actuels, pour les spikes d'extraction et la démonstration.
- Le dossier `corpus/` ne contient aucun secret : il peut être versionné.

## 10. Tests

Priorité absolue : le **moteur**. Les tests qui protègent la promesse du produit :

| Domaine | À vérifier |
|---|---|
| Masquage | Déterminisme (mêmes entrées, même sortie) ; remplacement du plus long au plus court ; frontières de mot ; insensibilité à la casse, aux accents et aux espaces insécables ; un placeholder déjà inséré n'est jamais retouché |
| Cohérence | Même entité, même placeholder sur plusieurs tours ; numéros jamais réutilisés après suppression d'une entité |
| Historique | Une entité ajoutée au tour 4 re-masque le tour 1 dans l'envoi suivant (`buildApiPayload`) |
| Anti-fuite | Détecte une valeur validée restée dans le texte ; détecte un motif de regex ; **bloque** l'envoi |
| Restauration | Valeurs rétablies ; placeholders inconnus et mal formés signalés |
| Flux | Le restaurateur en flux donne le même résultat quel que soit le découpage : tester en coupant le texte **à chaque position possible**, y compris au milieu d'un placeholder |
| Conflits | Deux personnes de même nom de famille : conflit signalé, jamais fusionné |
| Mentions du LLM | Les propositions absentes du texte sont écartées ; sortie JSON invalide gérée ; délai dépassé donne le mode dégradé |
| Journaux et erreurs | Aucune valeur de test dans les messages d'erreur ni les journaux |

Autres niveaux :

- **Intégration** : un fichier du corpus passe de bout en bout (extraction, détection, masquage, vérification) sans appeler l'API réelle. Le fournisseur est remplacé par un faux fournisseur qui renvoie une réponse contenant des placeholders, y compris coupés.
- **Manuel** : le parcours de démonstration (`DOCUMENTATION.md`, §13) est déroulé complet, sur l'installeur, avant chaque répétition. Une fiche de contrôle sera tenue dans `DEMO_SCRIPT.md`.
- **Mesure** : `pnpm measure` produit le tableau de rappel. Ses chiffres sont toujours accompagnés de la taille du corpus.

## 11. Workflow git

- Branche `main` : toujours dans un état qui compile et dont les tests passent.
- Travail sur de **courtes branches** (`feat/…`, `fix/…`, `doc/…`), fusionnées dès que les tests passent. Pas de branches longues : l'équipe est petite et le temps court.
- Commits petits, avec un message clair en français à l'impératif court (exemple : « Ajoute la propagation des variantes de noms »).
- Les commits rédigés par Claude portent la mention de co-auteur de l'environnement.
- Quand le contrat du moteur (annexe A de `DOCUMENTATION.md`) change, **le document est mis à jour dans le même commit**.
- Un tag `demo-v1` est posé sur le commit utilisé pour la démonstration. Après ce tag, seulement des corrections critiques, relues.
- Ne jamais commiter : clés, `config/local.config.json`, modèles, journaux, documents réels.

## 12. Définition de « terminé »

Une tâche est terminée quand :

1. Le code fonctionne sur le cas visé, vérifié (lancé, pas seulement relu).
2. `pnpm typecheck`, `pnpm lint` et les tests du paquet touché passent.
3. Les cas limites listés dans `DOCUMENTATION.md` ou `UI_UX.md` qui concernent la tâche sont traités ou explicitement reportés.
4. Aucun texte en clair n'est journalisé (§8).
5. La documentation est à jour si un contrat ou une décision a changé.
6. L'auteur sait **expliquer le choix à l'oral** : tous les membres de l'équipe pitchent et répondent aux questions du jury.

## 13. Empaquetage et machine de démonstration

- Construire l'installeur Windows **tôt**, pas la veille : le packaging de `node-llama-cpp` est le risque principal (`DOCUMENTATION.md`, §15).
- Tester l'installeur sur un **profil ou une machine propre**, sans l'environnement de développement.
- Le modèle local est préchargé sur la machine de démonstration avant le jury (ne pas compter sur le téléchargement en direct).
- Prévoir : connexion réseau pour l'appel à Claude, ou un fournisseur auto-hébergé de secours (`DOCUMENTATION.md`, annexe A.7).
- Prévoir un **plan B** : une vidéo du parcours de démonstration, enregistrée sur l'installeur final.
- Machine de démonstration : laptop d'abord ; PC avec 32 Go et RTX 5070 en secours, seuil de bascule défini après les tests de modèle.
- Après la finale : révoquer la clé API.

## 14. Ordre de départ

Pour la première session de code, dans cet ordre :

1. Vérifier le dépôt existant (§3) et commiter les documents encore non suivis.
2. Créer le monorepo vide (pnpm, TypeScript strict, Vitest, ESLint) avec les paquets `engine`, `desktop` et le stub `server`.
3. Faire tourner les **spikes** (`DOCUMENTATION.md`, §15), en commençant par `node-llama-cpp` empaqueté.
4. Écrire les types et la signature de l'API du moteur (annexe A), avec les tests de masquage et de flux en premier.
5. Brancher l'interface sur le moteur via les canaux IPC de l'annexe A.6.

Le planning détaillé par jour et par personne est traité à part.
