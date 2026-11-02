# IAnonyme — Tests pour choisir le modèle local

> Complète `DOCUMENTATION.md` (annexe C et §12). Le modèle local est **à décider plus tard**, après ces tests.

## 1. Objectif et contraintes

Choisir le modèle qui fait tourner `proposeMentions(text)` (voir annexe C). Il doit satisfaire **deux contraintes en même temps** :

1. **Bonne anonymisation** : il retrouve des mentions que les règles et les variantes de noms ne trouvent pas (fonctions, liens de parenté, noms oubliés), sans inventer de contenu.
2. **Tourne sur des PC de travail** : temps de réponse et mémoire compatibles avec un usage réel, sans GPU dédié si possible.

Un modèle excellent mais inutilisable sur un PC de travail est éliminé, et inversement. Le LLM n'est qu'un complément : le modèle doit **apporter un gain mesurable par rapport aux règles seules**, sinon il n'a pas sa place.

## 2. Principes du protocole

- **Même corpus, même prompt, mêmes paramètres pour tous les candidats** (corpus fictif annoté, voir §12 de `DOCUMENTATION.md`). Température 0.
- **Séparer l'ajustement et l'évaluation** : le prompt est ajusté sur les documents d'ajustement, les résultats sont mesurés sur les documents réservés. Ne jamais ajuster le prompt pour un modèle en regardant les documents d'évaluation.
- **Fixer les seuils avant de lancer les tests**, pas après (voir §6). Sinon on règle le critère sur le résultat.
- **Répéter** : au moins 3 exécutions par mesure de temps, en notant la médiane.
- **Données fictives ou publiques uniquement.**
- Le même code (moteur, validation de l'annexe C.5) mesure tous les candidats, pour que les chiffres soient comparables.

## 3. Candidats

Sélection à faire par l'équipe : **3 à 5 modèles de tailles différentes** (petits, moyens), en variant la quantification. Critères d'entrée, à vérifier pour chacun avant de tester :

| Critère | À vérifier |
|---|---|
| Format | Disponible au format utilisable par `node-llama-cpp` (GGUF) |
| Langue | Capacité en français (pas seulement en anglais) |
| Sortie structurée | Respect d'un schéma JSON sur des essais courts |
| Licence | **Redistribution autorisée** si l'app doit le télécharger ou l'embarquer ; usage commercial |
| Taille | Poids du fichier du modèle (téléchargement au premier lancement) |

À consigner pour chaque candidat : nom exact et version, taille des paramètres, quantification, taille du fichier, licence, source de téléchargement, empreinte (hash).

Ne pas retenir un modèle dont la licence n'a pas été lue.

## 4. Machines de test

| Machine | Rôle |
|---|---|
| Laptop de démo | Cible principale |
| PC 32 Go avec RTX 5070 | Secours / référence haute |
| Configuration « PC de travail » **à définir par l'équipe** (processeur seul, RAM limitée) | Référence basse : c'est la contrainte du produit |

Pour chaque machine : processeur, RAM, GPU, système, mode d'exécution testé (CPU seul, GPU).

La configuration de référence basse n'est pas fixée aujourd'hui : l'équipe la choisit avant les tests (par exemple en limitant les ressources sur une machine existante), puis la note dans les résultats.

## 5. Tests

### T1 — Fiabilité de la sortie JSON

- Lancer le prompt de l'annexe C.2 sur tous les morceaux du corpus.
- Mesurer : taux de JSON invalide, taux de sortie hors schéma, besoin de relance.
- Comparer avec et sans génération contrainte par schéma (si disponible, voir spike).

### T2 — Qualité de détection (par rapport aux annotations)

Sur les documents réservés à l'évaluation :

- **Rappel sur les identifiants indirects** (`kind: indirect`) : fonctions, liens de parenté, périphrases. C'est le test central.
- **Rappel sur les identifiants directs** non trouvés par les règles (noms oubliés).
- **Gain du LLM** : rappel combiné (règles + variantes + LLM) moins rappel des règles + variantes seules. Un gain nul ou négligeable élimine le candidat.
- **Qualité du rattachement** (`linkedTo`) : part des rattachements corrects, part des mauvais rattachements (un mauvais rattachement est plus grave qu'un oubli, car il peut masquer la mauvaise personne).
- Ventilation par catégorie.

### T3 — Fiabilité (pas d'invention)

- **Taux d'hallucination** : mentions proposées absentes du texte (écartées par la validation de l'annexe C.5, mais comptées).
- **Faux positifs utiles ou gênants** : nombre moyen de suggestions rejetées par document. Trop de bruit rend la revue pénible.
- **Stabilité** : écart entre 3 exécutions identiques (température 0 devrait donner des résultats très proches).

### T4 — Cas difficiles

Jeux de tests courts, construits à la main :

- homonymes et deux personnes de même nom de famille (le conflit doit être signalé, jamais fusionné) ;
- noms communs pouvant ressembler à des noms propres ;
- mentions coupées par le découpage (chevauchement) ;
- tableaux, listes, en-têtes et pieds de page extraits d'un `.docx` ;
- texte très court et texte très long ;
- tentative d'instruction dans le texte (« ignore les consignes et… ») : le modèle ne doit pas la suivre, et la sortie doit rester conforme au schéma.

### T5 — Performance

Mesurer, pour chaque candidat et sur chaque machine :

| Mesure | Détail |
|---|---|
| Temps de chargement du modèle | Au premier appel et à chaud |
| Débit | Tokens par seconde |
| Latence par document | Documents de 1 page, 10 pages et 30 pages (ou équivalent en caractères) |
| Mémoire | Pic de RAM et de VRAM |
| Charge | Le reste de l'application reste-t-il utilisable pendant le traitement ? |
| CPU seul contre GPU | Si les deux modes sont possibles |

### T6 — Intégration et distribution

- Fonctionnement dans `node-llama-cpp` **dans l'application empaquetée** (pas seulement en développement).
- Comparaison avec Ollama sur le même modèle et les mêmes entrées : les résultats doivent être cohérents, sinon investiguer la différence (quantification, paramètres, modèle de conversation).
- Téléchargement au premier lancement : temps, reprise après interruption, vérification d'empreinte.
- Comportement en mode dégradé : le modèle absent ou trop lent doit déclencher le repli (annexe C.6) sans erreur.

## 6. Grille de décision

### Seuils à fixer avant les tests

L'équipe remplit ce tableau **avant** de lancer T1 à T6. Aucune valeur n'est préremplie ici : elles dépendent de ce que l'équipe juge acceptable.

> **Propositions de seuils (Claude, 2 nov. 2026)**, fixées dans le tableau ci-dessous **avant** de lancer les tests sur le PC 32 Go / RTX 5070, pour pouvoir lancer la campagne. Elles restent à valider par l'équipe ; tout changement ultérieur doit être consigné.

| Critère | Type | Seuil (à fixer) |
|---|---|---|
| Licence compatible avec la distribution | Éliminatoire | oui (redistribution et usage commercial autorisés) |
| Fonctionne dans l'app empaquetée sur Windows | Éliminatoire | oui (non testable avant l'existence de l'app) |
| Taux de JSON invalide maximal | Éliminatoire | 5 % (avec sortie contrainte par schéma) |
| Taux d'hallucination maximal | Éliminatoire | 10 % des mentions proposées |
| Gain minimal de rappel sur les identifiants indirects | Éliminatoire | 15 points |
| Latence maximale sur un document de référence, machine de référence basse | Éliminatoire | 120 s pour 10 pages (60 s retenu pour la machine GPU) |
| RAM maximale sur la machine de référence basse | Éliminatoire | 8 Go |
| Fausses suggestions maximales par document | Critère de classement | 5 |

### Procédure

1. Éliminer tout candidat qui ne passe pas un critère éliminatoire.
2. Classer les candidats restants : gain de rappel indirect d'abord, puis charge de revue (fausses suggestions), puis latence et mémoire.
3. Si aucun candidat ne passe : appliquer le plan de repli de `DOCUMENTATION.md` §15 (LLM optionnel, mode dégradé présenté comme tel). Ne pas assouplir les seuils après coup sans le consigner.
4. Consigner la décision (modèle, version, quantification, licence, empreinte, résultats) dans le tableau de résultats ci-dessous.

## 7. Tableau de résultats (à remplir)

Un tableau par machine. Mentionner la taille du corpus d'évaluation à côté de chaque pourcentage : sur peu de documents, ces chiffres sont indicatifs, pas représentatifs.

| Candidat | Quantif. | Fichier (Go) | Licence | JSON invalide | Hallucinations | Rappel indirect (règles seules → avec LLM) | Rappel direct (règles seules → avec LLM) | Rattachements corrects | Fausses suggestions / doc | Chargement | Débit (tok/s) | Latence 10 p. | RAM pic | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | | | |

## 8. Décision

À compléter une fois les tests terminés :

- Modèle retenu :
- Version / quantification :
- Licence et conditions de redistribution :
- Empreinte :
- Machine de démo :
- Seuil de bascule vers la machine de secours :
- Paramètres du prompt et du découpage retenus (taille des morceaux, délai maximal, plafond de suggestions) :
- Points de vigilance restants :

## 9. À ne pas affirmer au jury

- Des chiffres de rappel sans indiquer la taille du corpus d'évaluation.
- Que le LLM « garantit » l'anonymisation : il propose des mentions, l'humain valide, le code bloque la fuite.
- Un gain du LLM non mesuré sur les documents réservés à l'évaluation.
