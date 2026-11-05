# IAnonyme — Documentation de développement

> Version de travail pour la démo du Challenge Projets d'Entreprendre 2026 (équipe 59).
> Ce document regroupe la description fonctionnelle et la stack technique. Il est destiné aux développeurs.

## Table des matières

1. [Statut des informations et légende](#1-statut-des-informations-et-légende)
2. [Vision et principes](#2-vision-et-principes)
3. [Périmètre : démo vs produit](#3-périmètre--démo-vs-produit)
4. [Architecture](#4-architecture)
5. [Stack technique](#5-stack-technique)
6. [Entrées prises en charge](#6-entrées-prises-en-charge)
7. [Fonctionnalités de conversation](#7-fonctionnalités-de-conversation)
8. [Couche d'anonymisation](#8-couche-danonymisation)
9. [Mode de validation](#9-mode-de-validation)
10. [Données, session et sécurité](#10-données-session-et-sécurité)
11. [Contraintes non fonctionnelles](#11-contraintes-non-fonctionnelles)
12. [Mesure : corpus et métriques](#12-mesure--corpus-et-métriques)
13. [Parcours de démo](#13-parcours-de-démo)
14. [Critères « ça marche »](#14-critères--ça-marche-)
15. [Risques techniques et plans de repli](#15-risques-techniques-et-plans-de-repli)
16. [Points ouverts](#16-points-ouverts)
17. [Ce qu'il ne faut pas affirmer au jury](#17-ce-quil-ne-faut-pas-affirmer-au-jury)
18. [Hors périmètre](#18-hors-périmètre)
- [Annexe A — Contrat de données et API du moteur](#annexe-a--contrat-de-données-et-api-du-moteur)
- [Annexe B — Catalogue de détection](#annexe-b--catalogue-de-détection)
- [Annexe C — LLM local : prompt, schéma et validation](#annexe-c--llm-local--prompt-schéma-et-validation)

Document complémentaire : `MODELE_LOCAL_TESTS.md` (tests pour choisir le modèle local).

---

## 1. Statut des informations et légende

Chaque élément est marqué selon son statut :

- **Décidé** : validé par l'équipe.
- **À décider plus tard** : volontairement repoussé, avec un processus prévu pour trancher.
- **Ouvert** : à trancher.

Chaque fonctionnalité est classée :

- **Prototype** : à livrer d'ici mercredi 4 novembre.
- **Plus tard** : à présenter comme évolution, jamais comme existant.

## 2. Vision et principes

IAnonyme est une application de conversation avec une IA, à l'usage classique, où rien de ce que l'utilisateur saisit ou importe ne part vers l'API sans avoir été masqué, et où les réponses sont restituées avec les vraies valeurs. L'utilisateur converse en clair ; l'API ne voit que des placeholders (`[PERSONNE_1]`, etc.).

- **Décidé** : principe anonymiser en entrée → interroger l'IA via API → désanonymiser en sortie.
- **Décidé** : segment de départ = cadre judiciaire (experts). La cible précise reste **ouverte** (experts seuls, ou aussi avocats, greffes, cabinets).

**Principe directeur : le code transforme les textes, le LLM local ne fait que proposer des mentions, l'utilisateur valide.**

Conséquence : le LLM n'écrit jamais le texte masqué. Il renvoie des propositions (JSON), que le code vérifie (la mention doit figurer dans le texte) avant de les présenter à l'utilisateur.

## 3. Périmètre : démo vs produit

On développe aujourd'hui **une démo**. La partie serveur est décrite pour le produit cible, mais **elle est ignorée dans le développement actuel**.

| Composant | Démo (maintenant) | Produit (cible) |
|---|---|---|
| Application desktop (Electron) | Réel | Réel |
| Moteur d'anonymisation (`engine`) | Réel | Réel |
| LLM local | Réel (avec mode dégradé) | Réel |
| Appel à l'API Claude | Réel, clé donnée à l'app de démo | Via compte utilisateur |
| Table de correspondance | En mémoire, session unique | SQLite chiffré (roadmap) |
| Serveur | **Ignoré** : stub vide dans le monorepo | Hébergeur français |
| Comptes utilisateurs | **Ignorés** : écrans maquette sans connexion réelle | Réel |

**Règle pour l'équipe** : ne pas développer de logique serveur. Le dossier `server` n'est qu'un stub. Les écrans de compte sont des maquettes. Au jury, on les présente comme maquette, avec un schéma « prototype vs produit ».

## 4. Architecture

Le texte est masqué sur le poste de l'expert. La table de correspondance reste en mémoire locale. Seul le texte masqué part vers l'API.

Flux d'un message :

1. L'utilisateur saisit ou importe un texte.
2. **Détection déterministe** : regex, règles, propagation des variantes de noms.
3. **Détection LLM local** (identifiants indirects) : propose des mentions en JSON ; le code vérifie qu'elles figurent dans le texte.
4. **Revue humaine** (selon le mode de validation, voir §9).
5. **Masquage** : remplacement par des placeholders cohérents, enregistrés dans la table de correspondance.
6. **Contrôle anti-fuite bloquant** : aucune valeur sensible validée ne doit subsister ; les regex sont relancées sur le texte masqué. En cas d'échec, l'envoi est bloqué.
7. **Envoi à l'API Claude** : le texte masqué et tout l'historique, lui aussi masqué.
8. **Restauration** : les placeholders de la réponse sont remplacés par les vraies valeurs ; anomalies signalées.

Sans LLM local, l'application fonctionne en **mode dégradé** (règles et variantes de noms seuls) et l'indique clairement à l'utilisateur.

**Point critique** : à chaque tour, l'API reçoit tout l'historique de la conversation. Il doit être renvoyé sous sa forme masquée, avec les **mêmes placeholders** d'un tour à l'autre (`[PERSONNE_1]` désigne toujours la même personne dans toute la conversation).

## 5. Stack technique

### Décidé

| Sujet | Choix |
|---|---|
| Langage | Tout en TypeScript (Rust et Tauri en roadmap) |
| App desktop | Electron, démo sur Windows |
| LLM local | `node-llama-cpp` dans Electron, derrière l'interface `proposeMentions(text)`. Ollama sert pour développer et comparer. Le modèle est choisi **par configuration** (annexe A.7), pas dans le code. Modèle précis : **à décider plus tard** (voir `MODELE_LOCAL_TESTS.md`). |
| Détection | Regex et règles, propagation des variantes de noms, puis LLM pour les identifiants indirects |
| API IA | Claude, clé donnée directement à l'app de démo. Fournisseur interchangeable (annexe A.7) : un modèle auto-hébergé sur le poste de démonstration est possible. Modèle précis : **à décider plus tard**. |
| Serveur et comptes | Simulés pour la démo (écrans de compte sans vraie connexion) ; hébergeur français en cible |
| Import | `.txt`, `.docx` et PDF avec texte. Images et PDF scannés refusés avec un message clair. OCR et anonymisation d'images en roadmap. |

### Également décidé

- Interface en **Vite + React**.
- Appels API depuis le **processus principal** d'Electron. La clé est dans un fichier de configuration **hors dépôt**, avec plafond de dépense, **révoquée après la finale**.
- **Monorepo pnpm** avec trois paquets : `engine`, `desktop`, `server` (stub réduit).
- Table de correspondance en mémoire (session unique). SQLite chiffré en roadmap.
- Modèle local téléchargé au premier lancement, avec vérification d'empreinte.
- Validation hybride (voir §9).
- Dictionnaire d'affaire : hors prototype (voir §8.7).
- Mesure : 5 à 10 documents fictifs annotés, script TypeScript qui réutilise le moteur de l'app (voir §12).

### Structure de dépôt proposée

```
ianonyme/
├── packages/
│   ├── engine/      # détection, masquage, restauration, anti-fuite, table de correspondance
│   ├── desktop/     # Electron (main + preload) et UI Vite + React
│   └── server/      # STUB — ignoré pour la démo
├── corpus/          # documents fictifs annotés + liste de référence
├── scripts/         # script de mesure du rappel (réutilise engine)
├── DOCUMENTATION.md
├── MODELE_LOCAL_TESTS.md
└── pnpm-workspace.yaml
```

Le paquet `engine` ne dépend ni d'Electron ni de React.

### Contrat du moteur et du LLM local

Les types (`Mention`, `Entity`, `ConversationState`…), l'API du moteur et les canaux IPC sont définis en **annexe A**. Le catalogue de détection est en **annexe B**. Le prompt, le schéma JSON et la validation des sorties du LLM sont en **annexe C**. L'interface du LLM reste `proposeMentions(text)`, derrière laquelle on peut changer de modèle ou de moteur d'inférence sans toucher au reste.

## 6. Entrées prises en charge

| Entrée | Traitement | Statut |
|---|---|---|
| Message saisi | Détection, masquage | Prototype |
| Texte collé | Idem | Prototype |
| Fichier `.txt` | Extraction du texte, détection, revue | Prototype |
| PDF à texte sélectionnable | Idem | Prototype |
| Fichier `.docx` | Idem | Prototype (**décidé**) |
| Nom du fichier | Détecté et masqué (il contient souvent un nom) | Prototype |
| Métadonnées du fichier | Jamais envoyées : seul le texte l'est | Prototype |
| Consigne système de l'application | Contrôlée par nous, pas d'anonymisation | Prototype |
| Images, captures, PDF scannés | **Envoi bloqué avec message explicite**, jamais d'échec silencieux | Prototype (blocage) ; OCR Plus tard |
| Voix | Hors périmètre | Plus tard |

### Règles d'extraction du texte

Seul le **texte extrait** est analysé, masqué et envoyé. Les images intégrées, les métadonnées et tout ce qui n'est pas extrait ne partent jamais ; l'application avertit quand du contenu n'est pas pris en compte.

| Format | Contenu extrait | Cas particuliers |
|---|---|---|
| `.txt` | Texte brut, encodage UTF-8 (détection du BOM) | Encodage non reconnu : refus avec message |
| `.docx` | Corps, tableaux, en-têtes, pieds de page, notes de bas de page et de fin | Commentaires et révisions non extraits, avec avertissement s'il y en a. Images ignorées avec avertissement. |
| PDF | Texte des pages ayant une couche de texte | Aucune couche de texte : **blocage** (PDF scanné). Pages isolées sans texte : avertissement avec les numéros de page. Images intégrées ignorées avec avertissement. |

- Une taille maximale de fichier (et de texte extrait) sera fixée après les premiers tests.
- Le nom du fichier est traité comme une entrée : il passe par la détection et n'est jamais envoyé en clair.
- Les bibliothèques d'extraction (PDF, `.docx`) sont choisies pendant les spikes (voir §15).

## 7. Fonctionnalités de conversation

| Fonctionnalité | Statut |
|---|---|
| Zone de saisie, envoi, réponse affichée en continu (streaming) | Prototype |
| Plusieurs conversations : liste à gauche, création, renommage, suppression | Prototype |
| Rendu Markdown des réponses (listes, tableaux, code) | Prototype |
| Copier la réponse, régénérer, arrêter la génération | Prototype |
| Import de fichiers dans la conversation | Prototype |
| Choix de l'assistant pour la démo : Claude (service en ligne) ou modèle auto-hébergé sur le poste de démonstration | Prototype minimal (liste courte, selon la configuration). Modèle précis **à décider plus tard**. |
| Réglage « Analyser aussi les messages » (analyse approfondie des messages après clic sur Envoyer, activé par défaut) | Prototype (voir §11) |
| Mode « invisible » : envoi automatique sans aperçu, vérification a posteriori | Plus tard |
| Modèles de tâches pour l'expert : résumé de dossier, chronologie des faits, relevé de contradictions | Prototype (3 modèles au plus) |
| Export de la conversation ou d'une réponse en `.docx` | Plus tard |
| Comptes utilisateurs, partage, travail à plusieurs | Plus tard (maquette seulement) |

## 8. Couche d'anonymisation

### 8.1 Détection en direct (Prototype)

Pendant la frappe, les regex et variantes de noms surlignent les données sensibles du message (détection instantanée). Le LLM local n'intervient **pas** pendant la frappe : il s'exécute après le clic sur Envoyer (voir §11).

### 8.2 Indicateur de protection (Prototype)

Un bandeau visible indique le nombre d'entités masquées dans le message et dans la conversation, et si des points restent à traiter.

### 8.3 Aperçu du texte envoyé (Prototype)

Avant l'envoi, un volet « Ce qui part à l'API » montre exactement le texte masqué.

### 8.4 Revue des suggestions (Prototype)

Les mentions proposées par le LLM local (fonctions, liens de parenté, équivalences comme « le maire de la commune » = « M. Garnier ») sont affichées avec leur **source** (`regex`, `variant`, `llm`). L'utilisateur peut :

- accepter,
- rejeter,
- rattacher à une entité existante,
- ajouter à la main.

Les attributions conflictuelles sont **signalées, jamais fusionnées automatiquement**.

### 8.5 Contrôle anti-fuite bloquant (Prototype)

Avant l'envoi, le code vérifie qu'aucune valeur sensible validée ne subsiste dans le texte, et relance les regex sur le texte masqué. En cas d'échec, l'envoi est **bloqué**.

### 8.6 Restauration (Prototype)

Les placeholders des réponses sont remplacés par les vraies valeurs. Les valeurs restaurées sont visuellement repérables. Les placeholders inconnus ou altérés par l'IA sont signalés.

### 8.7 Dictionnaire d'affaire (Plus tard — hors prototype, décidé)

L'utilisateur déclare à l'avance des termes à toujours masquer (parties, société, lieu), pour une conversation ou un dossier. À présenter comme évolution, pas comme existant.

## 9. Mode de validation

**Décidé : option 3 (hybride).** Les options étudiées :

| Option | Description | Compromis |
|---|---|---|
| 1. Systématique | Tout message passe par l'écran de revue | Sûr, mais lourd |
| 2. Automatique | Le message part dès que le contrôle anti-fuite est passé ; consultation possible après | Fluide, mais les identifiants indirects peuvent passer |
| 3. **Hybride (retenue)** | Messages courts envoyés automatiquement après détection déterministe, avec aperçu et possibilité de corriger avant envoi. Revue **obligatoire** pour les fichiers, chaque fois que le LLM propose des suggestions, et en cas de conflit. | Garde la fluidité d'un chat et concentre la vigilance humaine là où le risque est le plus élevé |

Implémentation : la fonction `requiresReview` (annexe A.3) décide si la revue est obligatoire.

**Principe** : le processus est automatique, et l'utilisateur peut **vérifier à chaque envoi** ce qui part (aperçu « Ce que l'IA va recevoir »). Les messages courts ne sont donc pas laissés sans contrôle : un nom que les règles ne connaissent pas est rattrapé par la vérification humaine. Un mode « invisible » (sans aperçu, vérification a posteriori) pourrait être une évolution ; il n'est pas prévu dans la démo.

## 10. Données, session et sécurité

- **Table de correspondance** : chiffrée, conservée localement, **jamais envoyée à l'API**. Pour la démo : en mémoire (Prototype).
- **Historique** : session unique, tout est purgé à la fermeture (Prototype). Historique persistant (SQLite chiffré) : évolution, à présenter avec ses conditions.
- **Clé API** : fichier de configuration hors dépôt, plafond de dépense, révoquée après la finale. Ne jamais la committer.
- **LLM local** : tourne sur la machine de l'utilisateur (Prototype).
- **Métadonnées de fichiers** : jamais envoyées.
- **Côté fournisseur d'API** : il reçoit un texte masqué. Ce qu'il en fait relève de ses conditions, **non vérifiées** : ne rien affirmer sans source.
- **Documents de test et de démo** : fictifs ou publics uniquement.
- **Cadre juridique (RGPD, secret professionnel)** : non sourcé à ce jour. Toute affirmation de conformité doit être validée par un juriste.

## 11. Contraintes non fonctionnelles

- **Fonctionnement dégradé** : si le LLM local est trop lent ou absent, l'app marche avec regex et variantes seuls, et l'indique clairement.
- **Latence** : détection déterministe quasi instantanée pendant la frappe ; passage LLM sur les fichiers à l'import et sur les messages après le clic sur Envoyer. La durée de l'analyse n'a pas à suivre le rythme de la frappe, mais l'utilisateur attend sa fin avant l'envoi réel : les durées réelles restent à mesurer sur les machines de l'équipe.
- **Réglage « Analyser aussi les messages »** : active le passage du LLM local sur les messages saisis, pas seulement sur les fichiers. Par conversation, **activé par défaut** (désactivable pour envoyer plus vite). L'analyse s'exécute **après le clic sur Envoyer**, avant l'envoi à l'assistant ; la revue est obligatoire si le LLM propose des suggestions (cf. §9). Sans LLM disponible, le réglage est inactif et l'application passe en mode dégradé.
- **Streaming et placeholders coupés** : un placeholder peut arriver coupé entre deux fragments (`[PERS` puis `ONNE_1]`). Le code doit **mettre en attente tout fragment commençant par `[`** avant de l'afficher, puis restaurer une fois le placeholder complet.
- **Cohérence des placeholders** : mêmes placeholders pour une même entité sur tous les tours.

## 12. Mesure : corpus et métriques

### Corpus

- 5 à 10 documents **fictifs** annotés à la main (jamais de données réelles).
- Formats variés : au moins un `.txt`, un `.docx` et un PDF avec texte.
- Contenu à couvrir : identifiants directs (noms, adresses, téléphones, IBAN, numéros de dossier), **identifiants indirects** (fonctions, liens de parenté, « le maire de la commune »), variantes d'un même nom (civilité, nom seul, initiale, casse), noms dans des tableaux, en-têtes ou pieds de page, noms dans le nom de fichier, homonymes, et au moins un cas de conflit (deux personnes de même nom de famille).
- **Séparation** : réserver au moins 2 documents à l'évaluation finale, jamais utilisés pour ajuster les règles ni le prompt. Sans cela, le rappel mesuré est flatté. Les documents d'ajustement servent à régler, les documents réservés à mesurer.

### Format d'annotation

Un fichier JSON par document, à côté du document (`corpus/<nom>.annotations.json`) :

```json
{
  "document": "rapport-expertise-01.docx",
  "entities": [
    {
      "id": "E1",
      "category": "PERSONNE",
      "canonical": "Jean Garnier",
      "mentions": [
        { "text": "M. Garnier", "kind": "direct" },
        { "text": "le maire de la commune", "kind": "indirect" }
      ]
    }
  ]
}
```

`kind` vaut `direct` (nom, numéro, adresse…) ou `indirect` (fonction, lien de parenté, périphrase). Chaque `text` doit apparaître tel quel dans le texte extrait du document. Un script de vérification contrôle cette règle avant toute mesure.

### Métriques

- **Rappel** : part des mentions de référence détectées, par catégorie **et** par source (`regex`, `variant`, `llm`), séparément pour `direct` et `indirect`. Une mention est « détectée » si elle est masquée dans le texte envoyé.
- **Gain du LLM** : rappel avec LLM moins rappel sans LLM (règles et variantes seules). C'est la mesure qui justifie le LLM.
- **Taux de fuite** : part des valeurs de référence retrouvées par recherche exacte dans le texte masqué final. Ne compte que les valeurs de référence, pas les recoupements d'indices.
- **Fausses suggestions** : nombre moyen par document de suggestions rejetées (charge de revue pour l'utilisateur).
- **Statistiques LLM** : JSON invalides, hallucinations (mention absente du texte), temps de traitement (voir annexe C.5).

### Présentation et limites

- Le tableau de rappel est affiché tel quel dans l'app et le pitch, avec la **taille du corpus**. Sur 5 à 10 documents, aucun pourcentage n'est représentatif d'un usage réel ; on ne présente pas d'extrapolation.
- La recherche exacte ne détecte pas les ré-identifications par recoupement d'indices indirects : le taux de fuite n'est pas une garantie d'anonymat.
- Le script de mesure réutilise le moteur (`packages/engine`) sans passer par l'interface.
- Les scripts actuels (`scripts/*.py`) sont un banc d'essai provisoire en Python : leurs résultats portent sur cette réimplémentation, pas sur le moteur TypeScript. Les chiffres présentés comme ceux de l'application doivent être refaits avec le moteur.

### Qualité des réponses de l'IA sur texte masqué (à tester)

Masquer des informations peut appauvrir la réponse de l'IA (contexte perdu, confusion entre repères). Cette différence doit être **mesurée**, pas supposée.

- **Protocole** : mêmes documents fictifs, mêmes consignes (les trois modèles de tâches : résumé de dossier, chronologie des faits, relevé de contradictions), dans deux conditions : (A) texte en clair envoyé directement à l'assistant, (B) texte masqué, réponse restaurée. Seuls des documents fictifs sont envoyés, y compris en condition A.
- **À relever** : repères conservés tels quels dans la réponse, anomalies de restauration, confusions entre personnes, faits omis ou inventés, perte d'information liée aux mentions indirectes masquées.
- **Évaluation** : grille commune, notation par au moins deux membres de l'équipe, **sans savoir quelle condition ils évaluent**.
- **Limites** : échantillon réduit (peu de documents, peu de consignes) ; les résultats sont indicatifs, pas représentatifs. À présenter comme tels.

## 13. Parcours de démo

Durée visée : environ 3 minutes.

1. Importer un rapport d'expertise fictif.
2. Voir les entités surlignées, traiter les suggestions du LLM (« le maire de la commune » rattaché à M. Garnier).
3. Afficher « Ce qui part à l'API ».
4. Demander une chronologie des faits : réponse restaurée avec les vrais noms.
5. Poser une question de suivi où le nom est saisi directement : le message est masqué avec le **même** placeholder.
6. Montrer le blocage d'un envoi sans protection suffisante, puis le tableau de rappel mesuré sur le corpus fictif.

## 14. Critères « ça marche »

- Aucune valeur de la liste de référence n'apparaît dans le texte envoyé, sur les documents du corpus de test.
- Les placeholders restent cohérents sur au moins **5 tours** de conversation.
- Les valeurs sont restituées dans la réponse, avec les anomalies signalées.
- Le tableau de rappel par catégorie et par source est affiché, et honnête sur la taille du corpus.

## 15. Risques techniques et plans de repli

### Spikes de validation (avant le développement)

Courts tests jetables, à faire en premier : ils décident de l'architecture. Chacun a un critère de réussite et un repli.

| Spike | Critère de réussite | Repli si échec |
|---|---|---|
| `node-llama-cpp` dans Electron | Un petit modèle se charge et répond dans Electron **en développement et dans l'installeur Windows empaqueté** | `llama-server` en processus enfant, puis LLM optionnel |
| Extraction PDF | Texte correct sur 2 à 3 PDF réalistes (plusieurs colonnes, tableaux, en-têtes) ; détection fiable d'un PDF sans couche de texte | Autre bibliothèque d'extraction ; sinon limiter les PDF acceptés |
| Extraction `.docx` | Texte correct sur 2 à 3 `.docx` réalistes (tableaux, en-têtes et pieds de page, notes de bas de page) | Autre bibliothèque d'extraction |
| Appel API Claude en streaming depuis le processus principal | Flux reçu et transmis au renderer par événements ; arrêt de la génération fonctionnel | — |
| Placeholder coupé en streaming | Le restaurateur en flux (`createStreamRestorer`) reconstitue correctement `[PERS` + `ONNE_1]` | — |

### Risques principaux

1. Packaging de `node-llama-cpp` dans l'installeur Windows (couvert par le premier spike).
2. Lecture de PDF et de `.docx` réalistes.
3. Temps de calcul et mémoire du LLM sur le laptop de démo (couvert par `MODELE_LOCAL_TESTS.md`).

### Plans de repli

- Si `node-llama-cpp` bloque plus d'une demi-journée au packaging : utiliser `llama-server` en **processus enfant**.
- Si cela bloque aussi : le LLM devient un **module optionnel**, présenté comme tel.
- Machine de démo : laptop d'abord ; PC avec 32 Go et RTX 5070 en secours. Seuil de bascule à fixer **mercredi matin**, après test sur le même corpus que pour Ollama (voir `MODELE_LOCAL_TESTS.md`).

## 16. Points ouverts ou à décider plus tard

À décider plus tard :

- **Modèle local précis** : taille, licence de redistribution, quantification. Décision prise après les tests décrits dans `MODELE_LOCAL_TESTS.md` (tests en cours). Le changement se fait par configuration (annexe A.7), sans modification du code.
- **Modèle Claude (ou autre) utilisé pour la démo** : selon les clés disponibles.

Ouverts :

- **Conditions de traitement du texte masqué** par le fournisseur d'API : non vérifiées.
- **Cible précise** (experts seuls ou aussi avocats, greffes, cabinets).
- **Cadre juridique** (RGPD : anonymisation ou pseudonymisation ? secret professionnel) : à sourcer et à faire valider par un juriste.
- **Différence de qualité des réponses** entre texte en clair et texte masqué : à mesurer (§12).
- **Formats exacts de numéros de dossier** (RG, parquet, références d'expertise) : à relever sur des documents publics ou des modèles réalistes.
- **Limites chiffrées** : taille maximale de fichier, délai maximal du LLM, taille des morceaux. À fixer après les tests de modèle.

## 17. Ce qu'il ne faut pas affirmer au jury

Sans vérification préalable, ne pas dire :

- « Le fournisseur ne conserve rien » ou « notre serveur ne traite pas de données personnelles ».
- Que le compte et le serveur existent réellement : les présenter comme **maquette**, avec un schéma prototype vs produit.
- Que l'anonymisation d'images est prévue sans réserve : c'est de la **roadmap**.
- Qu'IAnonyme est conforme au RGPD ou au secret professionnel.
- Que la qualité des réponses est « équivalente » avec et sans masquage, tant que le test du §12 n'a pas été fait.

## 18. Hors périmètre

OCR et images, multi-utilisateurs, comptes réels, serveur, déploiement cloud, historique persistant chiffré, intégrations (messagerie, outils métier), certification ou conformité attestée.

---

## Annexe A — Contrat de données et API du moteur

> Cette annexe, comme les annexes B et C, a été rédigée pour combler les manques de la première version. C'est une base de travail : à relire et corriger par l'équipe avant de coder, mais à figer dès que possible, car le moteur, le processus principal et l'interface en dépendent tous.

### A.1 Types

```ts
export type Category =
  | 'PERSONNE' | 'ORGANISATION' | 'LIEU' | 'ADRESSE'
  | 'EMAIL' | 'TELEPHONE' | 'IBAN' | 'DATE_NAISSANCE'
  | 'NUM_DOSSIER' | 'IDENTIFIANT' | 'FONCTION' | 'LIEN_PARENTE';

export type Source = 'regex' | 'variant' | 'llm' | 'manual';

export interface Span { start: number; end: number }  // offsets dans le texte source

export interface Mention {
  id: string;
  text: string;                  // valeur telle qu'elle apparaît dans le texte
  span: Span;
  category: Category;
  source: Source;
  entityId?: string;             // entité rattachée, si connue
  status: 'suggested' | 'accepted' | 'rejected';
}

export interface Entity {
  id: string;                    // ex. "E12"
  category: Category;
  canonical: string;             // forme de référence, ex. "Jean Garnier"
  variants: string[];            // autres formes à masquer, ex. ["Garnier", "M. Garnier"]
  placeholder: string;           // ex. "[PERSONNE_1]"
}

export interface Conflict {
  mentionId: string;
  candidateEntityIds: string[];  // plusieurs entités possibles : jamais fusionnées automatiquement
  reason: string;
}

export interface ConversationState {
  entities: Record<string, Entity>;
  counters: Partial<Record<Category, number>>;  // dernier numéro attribué par catégorie
  rejectedValues: string[];                     // valeurs rejetées : plus jamais suggérées dans cette conversation
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  clear: string;                 // seule version stockée ; la version masquée est toujours recalculée
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  state: ConversationState;
  settings: { assistantId: string; deepAnalysisOnMessages: boolean };
}
```

### A.2 Format des placeholders

- Forme : `[CATEGORIE_N]`, par exemple `[PERSONNE_1]`, `[ORGANISATION_2]`. Motif de reconnaissance : `\[[A-Z_]+_\d+\]`.
- **Personnes dont le prénom et le nom sont connus** : le prénom et le nom de famille ont chacun leur repère, `[PRENOM_1] [NOM_1]`. Les repères sont partagés : « Isabelle Brunet » et « Patrick Brunet » donnent `[PRENOM_1] [NOM_1]` et `[PRENOM_2] [NOM_1]`, et « l'affaire Brunet » devient « l'affaire `[NOM_1]` », sans ambiguïté à trancher. L'assistant voit ainsi le lien entre les personnes de même nom. Une personne connue par son seul nom garde `[PERSONNE_N]`. Dans l'interface, le prénom et le nom restent côte à côte et aucun repère n'est affiché.
- **Fonction ou lien de parenté rattaché à une personne** (« le gérant », « son beau-frère ») : le texte de la fonction reste lisible et le repère de la personne est ajouté, `[PRENOM_1] [NOM_1] (le gérant)`, sans répéter le repère quand le nom est juste à côté (`[PRENOM_1] [NOM_1], gérant,`). Les éléments identifiants contenus dans la fonction sont masqués (`maire de [LIEU_2]`). Si la fonction contient un mot capitalisé non protégé, elle est remplacée en entier par le repère. L'assistant garde ainsi la fonction (« Étienne Vasseur est le gérant de la société »). La vérification de sécurité ne signale pas une fonction générique laissée lisible.
- `N` est un compteur par catégorie et par conversation.
- Un numéro n'est **jamais réattribué ni réutilisé**, même si l'entité est supprimée.
- Une même entité garde le même placeholder pendant toute la conversation.

### A.3 API du moteur (`packages/engine`)

Toutes les fonctions sont pures : elles reçoivent un état et renvoient un nouvel état, sans effet de bord. C'est ce qui permet de les appeler depuis l'app et depuis le script de mesure.

```ts
// Détection déterministe (regex + variantes), synchrone et rapide
detect(text: string, state: ConversationState): { mentions: Mention[]; conflicts: Conflict[] };

// Intégration des propositions du LLM local (vérification, dédoublonnage, voir annexe C)
mergeLlmMentions(raw: LlmMention[], text: string, state: ConversationState)
  : { mentions: Mention[]; conflicts: Conflict[]; stats: LlmStats };

// Décisions de l'utilisateur
acceptMention(state, mention, entityId?): ConversationState;  // crée l'entité si entityId absent
rejectMention(state, mention): ConversationState;
linkMention(state, mention, entityId): ConversationState;
addManualMention(state, text, category, entityId?): ConversationState;

// Masquage
mask(text: string, state: ConversationState): { masked: string; replacements: Replacement[] };

// Contrôle anti-fuite
checkLeak(masked: string, state: ConversationState): LeakReport;
// LeakReport = { ok: boolean; leaks: { value: string; entityId?: string; kind: 'exact' | 'regex' }[] }

// Restauration
restore(text: string, state: ConversationState): { restored: string; segments: Segment[]; anomalies: Anomaly[] };
// Segment = { text: string; restoredFrom?: string /* entityId */ }
// Anomaly = { kind: 'unknown_placeholder' | 'malformed_placeholder'; text: string; position: number }

// Restauration en flux (voir §11)
createStreamRestorer(state): { push(chunk: string): Segment[]; flush(): Segment[]; anomalies: Anomaly[] };

// Mode de validation hybride (voir §9)
requiresReview(input: { isFile: boolean; pendingLlmSuggestions: number; conflicts: number }): boolean;

// Construction de la charge utile envoyée à l'API
buildApiPayload(conv: Conversation): { messages: { role: string; content: string }[]; leak: LeakReport };
```

### A.4 Règles de masquage

- **Entrées masquées** : seules les entités au statut `accepted` sont masquées. Une suggestion en attente n'est pas masquée, ce qui oblige à la traiter avant l'envoi (cf. mode hybride).
- **Une seule passe** : toutes les variantes de toutes les entités acceptées sont remplacées en une passe, **de la plus longue à la plus courte**. On ne chaîne pas des `replace` successifs, qui pourraient altérer un placeholder déjà inséré.
- **Normalisation à la comparaison** : insensible à la casse et aux accents, apostrophes droites et typographiques équivalentes, espaces insécables traités comme des espaces, tirets traités comme des espaces. Le texte original n'est jamais modifié en dehors des remplacements.
- **Frontières de mot** : une variante ne se masque que si elle est délimitée par des frontières de mot (pas de masquage au milieu d'un mot).
- **Déterminisme** : mêmes entrées et même état donnent toujours le même texte masqué.

### A.5 Historique et re-masquage

Seule la version en clair des messages est stockée. À **chaque envoi**, `buildApiPayload` recalcule la version masquée de **tout l'historique** avec l'état courant, puis lance `checkLeak` sur l'ensemble de la charge utile.

Conséquence voulue : si l'utilisateur ajoute au tour 4 une entité qui apparaissait déjà au tour 1 sans avoir été détectée, le tour 1 est re-masqué dans le prochain envoi. Cela garantit aussi la cohérence des placeholders d'un tour à l'autre.

### A.6 Répartition entre processus Electron et IPC

- Le **processus principal** détient l'état de chaque conversation (source de vérité), exécute le moteur, extrait le texte des fichiers, pilote le LLM local et appelle l'API Claude.
- Le **renderer** (interface) n'a ni la clé API ni la table de correspondance durable : il envoie des commandes via le script `preload` et reçoit des résultats.
- Le dernier contrôle anti-fuite est exécuté **dans le processus principal, juste avant l'appel API**. Un défaut d'interface ne peut donc pas le contourner.

Canaux IPC minimaux :

| Canal | Entrée | Sortie |
|---|---|---|
| `files:import` | `{ convId, name, bytes }` | `{ ok, file: { id, name, readableName, maskedName, warnings[] }, text, blocked?: { reason } }` ; `files:discard` retire un fichier joint |
| `detect:run` | `{ convId, text, commit? }` | `{ mentions, conflicts, maskedText, protectedInText, leak }` ; sans `commit`, rien n'est enregistré (une frappe ne crée pas d'entité durable) |
| `llm:status` | — | `'ready' \| 'loading' \| 'absent' \| 'error'` |
| `llm:propose` | `{ convId, text }` | `{ mentions, conflicts, stats, degraded, degradedReason? }` ; tout échec (absent, délai, erreur) renvoie `degraded: true` |
| `llm:skip` | `{ convId }` | — (abandonne l'analyse en cours : « Passer en analyse de base ») |
| `mentions:decide` | `{ convId, action, mentionId, entityId? }` | nouvel état de la conversation |
| `chat:preview` | `{ convId, userText, fileIds, pendingSuggestions }` | `{ maskedPayload, maskedCurrent, leak, requiresReview, mentions, conflicts, … }` |
| `chat:send` | `{ convId, userText, fileIds, regenerate? }` | `{ requestId }` puis événements `chat:chunk` (`Segment[]`), `chat:done`, `chat:error` (codes d'erreur fixes, jamais de texte) |
| `chat:stop` | `{ convId }` | — |
| `conversation:*` | création, renommage, suppression | état de la liste |
| `settings:update` | `{ convId, assistantId?, deepAnalysisOnMessages? }` | réglages de la conversation |

### A.7 Fournisseurs d'assistant et configuration des modèles

Rien de spécifique à un modèle n'est écrit dans le code : tout passe par deux interfaces et un fichier de configuration. Changer d'assistant ou de modèle local est donc une modification de configuration.

```ts
interface AssistantProvider {
  id: string;        // ex. "claude", "demo-local"
  label: string;     // libellé affiché dans l'interface
  simulated: boolean; // vrai pour le faux assistant hors ligne : l'interface le dit
  stream(
    messages: { role: 'user' | 'assistant'; content: string }[],
    signal: AbortSignal,
    options?: { system?: string } // consigne système de l'application (docs/PROMPTS.md)
  ): AsyncIterable<string>;
}
```

- Un fournisseur ne reçoit **que** la charge utile produite par `buildApiPayload`, après la vérification de sécurité finale.
- Un modèle auto-hébergé sur le poste de démonstration emprunte **exactement le même chemin** que Claude (masquage, vérification, restauration). La protection n'est jamais contournée sous prétexte que le modèle est local : la démo reste représentative du produit.
- Types de fournisseur : `anthropic` (Claude), `openai-compatible` (modèle servi localement par Ollama ou `llama-server`) et `fake` (assistant scripté hors ligne, pour les tests et la démonstration sans réseau ; l'interface l'affiche comme « Assistant de démonstration (hors ligne) »). Les deux premiers sont testés contre un faux serveur local ; aucun test réel n'a été fait (pas de clé).
- Le point de passage unique vers un fournisseur est `secureStream` (`packages/desktop/src/main/secure-send.ts`) : il masque tout l'historique, lance la vérification de sécurité, et n'appelle le fournisseur qu'ensuite.

Fichier `config/local.config.json` (hors dépôt, avec la clé API) ; un exemple sans secret, `config/local.config.example.json`, est versionné :

```json
{
  "assistant": {
    "default": "claude",
    "providers": [
      { "id": "claude", "label": "Claude (service en ligne)", "type": "anthropic",
        "model": "À DÉCIDER", "apiKey": "…" },
      { "id": "demo-local", "label": "Modèle hébergé sur le poste de démonstration",
        "type": "openai-compatible", "baseUrl": "http://localhost:11434/v1", "model": "À DÉCIDER" }
    ]
  },
  "localModel": {
    "engine": "node-llama-cpp", // ou "fake" (scripté, tests) ou "none" (analyse de base)
    "active": "À DÉCIDER",
    "registry": [
      { "id": "…", "file": "…", "downloadUrl": "…", "sha256": "…",
        "contextSize": 0, "chunkChars": 2000, "timeoutMs": 0 }
    ]
  },
  "limits": { "maxFileBytes": 0, "maxMentionsPerChunk": 0 }
}
```

- `localModel.registry` liste les modèles candidats. `localModel.active` désigne celui qui est utilisé. Une fois le modèle choisi (voir `MODELE_LOCAL_TESTS.md`), on renseigne son entrée (empreinte, taille de contexte, taille des morceaux, délai maximal) et on change `active` : aucun changement de code.
- `chunkChars: 2000` reprend la valeur de départ du banc d'essai (`scripts/harness.py`). Les valeurs à `0` sont à fixer après les tests.
- Si le fournisseur choisi n'est pas configuré, il n'apparaît pas dans la liste de l'interface. La clé n'est jamais affichée.

### A.8 Compléments apportés par l'implémentation du moteur

Ajouts au contrat ci-dessus, faits au niveau 1 du développement (aucun n'en change les décisions) :

- `ConversationState` gagne deux champs : `entityCounter` (identifiants d'entités `E1`, `E2`… jamais réutilisés) et `preferred` (valeur normalisée partagée par plusieurs entités -> entité choisie par l'utilisateur, ce qui lève un conflit). `rejectedValues` contient des valeurs sous forme normalisée.
- `ingestText(state, text)` : détecte, accepte automatiquement ce que les règles et les variantes ont repéré (répété jusqu'à stabilité), renvoie l'état, les mentions et les conflits. Les suggestions du LLM et les conflits restent à traiter par l'utilisateur.
- `protectFileName(state, name)` : le nom du fichier passe par la détection et le masquage.
- Une valeur partagée par plusieurs entités et non tranchée **n'est pas masquée** : `checkLeak` la signale, donc l'envoi est bloqué jusqu'à ce que l'utilisateur choisisse (`linkMention`).
- Rejeter la forme de référence d'une entité (`rejectMention`) supprime l'entité ; rejeter une variante ne retire que cette variante.
- La normalisation conserve les décalages (une unité normalisée par unité du texte) ; accents combinants, traits d'union conditionnels et espaces de largeur nulle sont ignorés à la comparaison.
- Les repères déjà présents dans un texte (`[PERSONNE_1]`) ne sont jamais retouchés par le masquage.
- Les civilités sont propagées en variantes (`M.`, `Mme`, `Me`…) : un nom masqué avec sa civilité est restitué sous sa forme de référence, sans civilité.
- Liste de prénoms : écrite à la main (environ 400 prénoms courants), sans source externe ; à relire.
- Les juridictions publiques (« tribunal judiciaire de Dijon ») ne sont pas masquées par défaut (B.3), bien que « tribunal » figure dans les mots-clés d'organisation de B.1.

---

## Annexe B — Catalogue de détection

### B.1 Détection déterministe

Principe : **privilégier le rappel**. Les faux positifs sont acceptables, car l'utilisateur les rejette lors de la revue ; une donnée oubliée est ce qui compte vraiment. Les motifs ci-dessous sont un point de départ, à ajuster sur le corpus (formats à vérifier lors de l'écriture des tests).

| Catégorie | Méthode | Remarques |
|---|---|---|
| `EMAIL` | Regex | Format standard `local@domaine.tld` |
| `TELEPHONE` | Regex | Formats français (`0X XX XX XX XX`, avec points, tirets ou espaces) et internationaux (`+33 …`, `0033 …`) |
| `IBAN` | Regex + contrôle de clé | Un IBAN doit être détecté même avec des espaces ; validation de la clé pour limiter les faux positifs |
| `IDENTIFIANT` (n° de sécurité sociale) | Regex + contrôle de clé | 15 chiffres, éventuellement espacés |
| `IDENTIFIANT` (SIREN, SIRET) | Regex | 9 ou 14 chiffres, éventuellement espacés ; contrôle de somme possible |
| `IDENTIFIANT` (immatriculation) | Regex | Format `AA-123-AA` |
| `NUM_DOSSIER` | Regex | Numéros de dossier, de RG, de parquet, de référence d'expertise. Formats à relever sur des documents publics ou fictifs réalistes ; **à adapter au corpus** |
| `DATE_NAISSANCE` | Règle de contexte | Date précédée d'indices (« né(e) le », « date de naissance », « née le »). Voir B.3 sur les autres dates |
| `ADRESSE` | Règles | Numéro + type de voie (rue, avenue, boulevard, chemin, impasse, place…) + nom ; code postal + ville |
| `PERSONNE` | Règles + variantes | Civilité (M., Mme, Me, Maître, Dr, Pr, Monsieur, Madame) suivie de mots capitalisés ; suite de mots capitalisés dont le premier est un prénom connu (liste de prénoms courants, source à identifier) ; noms en majuscules |
| `ORGANISATION` | Règles | Formes juridiques (SARL, SAS, SA, SCI, EURL…) précédées d'un nom ; mots-clés (cabinet, société, association, tribunal, mairie…) suivis de mots capitalisés |
| `LIEU`, `FONCTION`, `LIEN_PARENTE` | LLM seulement | Pas de règle déterministe fiable : cas typique « le maire de la commune », « son beau-frère » |

### B.2 Propagation des variantes de noms

Quand une entité `PERSONNE` est acceptée (par exemple « Jean Garnier »), le moteur génère automatiquement ses variantes, puis les cherche dans tout le texte et dans toute la conversation :

- nom de famille seul (`Garnier`, `GARNIER`) ;
- civilité + nom (`M. Garnier`, `Monsieur Garnier`, `Mme Garnier`) ;
- initiale + nom (`J. Garnier`) ;
- inversion (`Garnier Jean`) ;
- prénoms composés (`Jean-Pierre` / `Jean Pierre`) ;
- particules (`de`, `du`, `Le`, `La`) conservées avec le nom ;
- formes avec élision ou apostrophe (`d'Garnier`, `chez M. Garnier`), couvertes par la gestion des frontières de mot (A.4).

Règles de sécurité :

- Le **prénom seul** n'est pas propagé automatiquement (trop de faux positifs, risque d'homonymes) ; il peut être ajouté manuellement ou proposé en suggestion.
- Un nom de famille **de moins de 3 lettres** ou égal à un mot courant n'est pas propagé seul ; il reste en suggestion à valider.
- Si deux entités partagent un même nom de famille (« Garnier père » et « Garnier fils »), toute occurrence ambiguë est signalée comme **conflit**, jamais rattachée automatiquement.

Les mêmes principes s'appliquent aux organisations (forme longue, forme courte, sigle) avec une propagation plus prudente.

### B.3 Ce qu'on ne masque pas par défaut

- Les **dates de faits** (hors dates de naissance) ne sont pas masquées : la chronologie des faits, qui fait partie de la démo, en dépend.
- Les montants, les références de textes de loi et les noms de juridictions publiques ne sont pas masqués, sauf s'ils sont détectés par une règle ci-dessus ou ajoutés manuellement.

L'utilisateur peut toujours ajouter une mention à la main. Le risque de ré-identification par des détails indirects reste réel et se traite par la revue (cf. §12 pour la limite de la mesure).

---

## Annexe C — LLM local : prompt, schéma et validation

Le LLM n'a qu'un rôle : **proposer des mentions** au format JSON, en décidant lui-même ce qui mérite d'être protégé (un métier générique comme « l'architecte » est laissé à l'assistant, « le maire de Saint-Cloud » est protégé) et quelles mentions désignent la même entité. Il ne réécrit jamais le texte. Le code valide chaque proposition (C.5) puis l'applique d'office, sauf les cas ambigus ; l'utilisateur peut tout corriger au moment de « Vérifier ». Le modèle précis est **à décider plus tard** (voir `MODELE_LOCAL_TESTS.md`) ; cette annexe doit fonctionner pour n'importe quel modèle retenu.

### C.1 Entrée

Pour chaque morceau de texte (voir C.4) :

- le texte en clair du morceau ;
- la liste des entités déjà connues (`canonical` + `category`), pour permettre le rattachement (« le maire de la commune » → « Jean Garnier »).

Le LLM tourne en local : le texte en clair ne quitte pas la machine à cette étape.

### C.2 Prompt (version de départ, à ajuster sur le corpus)

```
Tu aides à protéger l'identité des personnes dans un document juridique ou d'expertise avant qu'il soit
confié à un assistant. Tu décides toi-même quoi protéger. Tu ne réécris jamais le texte.

À PROTÉGER (à renvoyer) : ce qui permet d'identifier une personne, un lieu ou une organisation précis :
- noms de personnes, de lieux, d'organisations oubliés ;
- fonction qui désigne une personne précise parce qu'elle est rattachée à un lieu ou une structure (ex. « le maire de Saint-Cloud », « le gérant de la société X ») ;
- lien de parenté ou de proximité avec une personne (ex. « son beau-frère », « la voisine du 3e ») ;
- toute formulation qui désigne indirectement une personne ou une entité connue.

À LAISSER (ne pas renvoyer) : le contexte utile à l'assistant, qui n'identifie personne :
- métiers et qualités génériques (ex. « l'architecte », « l'expert », « le propriétaire », « le locataire » seuls, sans lieu ni nom) ;
- notions, lois, termes techniques, dates sans rapport avec une identité.

Pour chaque mention à protéger :
- "text" : la chaîne EXACTE, copiée telle qu'elle apparaît dans le texte, sans modification ; pour un nom propre, uniquement le nom (« Brunet », pas « l'affaire Brunet ») ;
- "category" : une des valeurs PERSONNE, ORGANISATION, LIEU, ADRESSE, FONCTION, LIEN_PARENTE, IDENTIFIANT ;
- "linkedTo" : si la mention désigne la même personne ou entité qu'une autre, le nom de cette autre : soit une entité connue de la liste, soit le "text" d'une autre mention de ta réponse (ex. « le maire de Saint-Cloud » relié à « Jean Dupont » si le texte les identifie l'un à l'autre) ; sinon null.
  Un lien de parenté désigne la personne elle-même, pas celle à qui il se rapporte : « son beau-frère » désigne le beau-frère, jamais la personne dont il est le beau-frère. Relie-le seulement à une personne nommée que le texte présente comme étant ce beau-frère.

Entités déjà connues (déjà protégées, ne les renvoie pas) : {{liste}}

Texte : {{texte}}

Réponds uniquement avec un objet JSON conforme au schéma. Si rien à protéger, renvoie {"mentions": []}.
```

### C.3 Sortie attendue (schéma JSON)

```ts
interface LlmMention {
  text: string;
  category: 'PERSONNE' | 'ORGANISATION' | 'LIEU' | 'ADRESSE' | 'FONCTION' | 'LIEN_PARENTE' | 'IDENTIFIANT';
  linkedTo: string | null;
}
interface LlmOutput { mentions: LlmMention[] }
```

Si `node-llama-cpp` permet de contraindre la génération par un schéma JSON (à vérifier pendant le spike), c'est la solution à privilégier. Sinon : parsing tolérant et une seule relance.

Paramètres : température 0 (reproductibilité de la mesure).

### C.4 Découpage

- Le texte est découpé par paragraphes, en morceaux dont la taille maximale dépend du contexte du modèle retenu (à fixer après les tests de modèle).
- Un chevauchement d'au moins un paragraphe évite de couper une mention.
- Les morceaux sont traités séquentiellement, avec indication de progression.

### C.5 Validation côté code (`mergeLlmMentions`)

Chaque sortie passe par ces étapes dans l'ordre :

1. **Parsing** JSON. En cas d'échec : une relance, puis abandon du morceau (compté dans `stats.invalidJson`).
2. **Schéma** : toute catégorie hors liste est ignorée.
3. **Littéralité** : `text` doit figurer **tel quel** dans le morceau (comparaison exacte, puis normalisée). Sinon la proposition est écartée et comptée comme hallucination (`stats.hallucinated`).
4. **Dédoublonnage** : écarter ce qui est déjà couvert par une entité ou une mention existante, ou ce qui figure dans `rejectedValues`.
5. **Rattachement** : `linkedTo` doit correspondre à une entité existante, sinon il est mis à `null` et la mention reste une simple suggestion.
6. **Conflits** : une mention rattachable à plusieurs entités est marquée `Conflict`, jamais résolue automatiquement.
7. **Plafond** : nombre maximal de suggestions par morceau, pour éviter de noyer l'utilisateur.

Les `stats` (JSON invalides, hallucinations, propositions retenues, temps) servent aussi à la mesure et au choix du modèle.

### C.6 Délai maximal et mode dégradé

- Un délai maximal par morceau, à fixer après les tests de modèle, déclenche l'abandon du LLM pour le document en cours.
- Dans ce cas, l'application poursuit avec les règles et variantes seules, et affiche clairement le message correspondant. Les mêmes messages s'affichent si le modèle est absent ou en erreur.
- L'utilisateur peut relancer le passage LLM à la demande.
