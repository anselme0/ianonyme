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

**PC 32 Go / RTX 5070 (12 Go) / Ryzen 7 7700X, Windows 11, Ollama 0.40.13.** Mesuré avec `scripts/harness.py` (prompt de l'annexe C.2, température 0, seed 42, `num_ctx` 8192, morceaux de 2000 caractères, sortie contrainte par schéma). **Corpus d'évaluation : 3 documents fictifs, 43 mentions directes et 9 mentions indirectes.** Chaque point de rappel indirect vaut donc environ 11 points de pourcentage : ces chiffres sont indicatifs, pas représentatifs.

| Candidat (digest Ollama) | Fichier (Go) | Licence | JSON invalide (contraint / libre) | Hallucinations | Rappel indirect (règles → +LLM) | Rappel direct (règles → +LLM) | Rattachements ok / mauvais / non rattachés | Fausses sugg. / doc | Chargement à froid | Débit GPU / CPU (tok/s) | Latence 1 p. GPU / CPU | Latence 10 p. GPU / CPU | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen2.5:1.5b (65ec06548149) | 1,0 | non lue | 14 % (1/7) / 0 % | 29 % (5/17) | 11 → 17 % | 95 → 98 % | 0 / 1 / 0 | 0 | 1,2 s | 334 / n.m. | 13 s / n.m. | 126 s / n.m. | **Éliminé** (gain +6 pts, JSON, hallucinations) |
| ministral-3:3b (f04aa1c738f6) | 3,0 | non lue | 0 % / 0 % | 0 % (0/28) | 11 → 56 % | 95 → 100 % | 2 / 1 / 6 | 0,3 | 2,0 s | 200 / 23 | 20 s / 88 s | 86 s / 848 s | Qualité OK ; **latence 10 p. hors seuil** |
| qwen3.5:4b (d8b0f5e9760c) | 3,3 | non lue | 0 % / sort du schéma (6 appels sur 9) | 5 % (2/41) | 11 → 67 % | 95 → 100 % | 1 / 0 / 12 | 0,3 | 5,6 s | 142 / 17 | 24 s / 170 s | 242 s / 1990 s | Meilleur gain ; **latence hors seuil** ; échoue aux homonymes |
| gemma3:4b (68ceab7e468a) | 3,4 | non lue (conditions Google) | 0 % / 0 % | 0 % (0/19) | 11 → 28 % | 95 → 100 % | 2 / 0 / 3 | 0 | 2,0 s | 166 / 20 | 12 s / 78 s | 131 s / 1106 s | Gain de 17 pts, juste au-dessus du seuil ; latence hors seuil ; échoue aux homonymes |
| phi4-mini (78fad5d182a7) | 2,5 | non lue | 0 % / 55 % (6/11) | 3 % (1/34) | 11 → 44 % | 95 → 98 % | 0 / 0 / 8 | 0 | 1,5 s | 192 / 22 | 7 s / 37 s | 114 s / 942 s | Le plus rapide ; latence 10 p. hors seuil ; aucun rattachement |
| ministral-3:8b (1922accd5827) | 6,0 | non lue | 0 % / 50 % (4/8) | 0 % (0/30) | 11 → 56 % | 95 → 100 % | 4 / 0 / 6 | 0,3 | 2,0 s | 107 / n.m. | 17 s / n.m. | 206 s / n.m. | Meilleurs rattachements ; latence hors seuil ; échoue aux homonymes |

n.m. = non mesuré (CPU abandonné pour `qwen2.5:1.5b`, éliminé, et `ministral-3:8b`, pour raccourcir la campagne).

### Résultats de T4 et T6

- T4, tous modèles : texte très court, noms communs, tentative d'injection (avec et sans schéma) et tableau/en-tête/pied de page : réussis. La sortie reste conforme au schéma face à l'injection.
- T4, homonymes (deux « Garnier » connus, le modèle ne doit pas rattacher « Garnier » seul) : **échec pour `qwen3.5:4b`, `gemma3:4b` et `ministral-3:8b`** ; réussi pour `qwen2.5:1.5b`, `ministral-3:3b`, `phi4-mini`.
- T4, chevauchement (morceaux de 350 caractères) : échec pour `ministral-3:3b` uniquement.
- T3, stabilité : 3 exécutions identiques pour les 6 modèles.
- T6 (partiel) : délai dépassé et modèle absent déclenchent une erreur gérée, sans plantage, pour tous. Le téléchargement a pris 30 à 45 s pour 2,5 à 3,4 Go. Non testés : `node-llama-cpp`, application empaquetée, comparaison avec Ollama, reprise de téléchargement, vérification d'empreinte.

### Limites de cette campagne

- **Le baseline de règles et le corpus sont de ma main** (`scripts/rules.py`, `corpus/`) : ce n'est pas le `packages/engine` du dépôt. Le rappel direct de 95 % est donc flatteur et à ne pas présenter tel quel.
- Seuls des fichiers `.txt` ont été testés : pas de `.docx` ni de PDF.
- Chaque document du corpus tient dans un seul morceau de 2000 caractères : le découpage et le chevauchement sont très peu sollicités. Les documents de 1 et 10 pages sont construits en répétant les mêmes textes (3000 caractères par page), ce qui produit beaucoup de sorties répétées : les latences sont probablement pessimistes pour de vrais documents.
- Les mesures de mémoire sont à écarter : la sonde ne voyait que le processus serveur d'Ollama (~130 Mo) et la VRAM comprend ~1,8 Go déjà utilisés par le bureau. La VRAM maximale va de ~3,4 Go (`qwen2.5:1.5b`) à ~8 Go (`ministral-3:8b`), à titre indicatif ; la RAM pic (seuil de 8 Go) n'est pas mesurée.
- La passe de 30 pages et la répétition à 3 des 10 pages en CPU ont été abandonnées (campagne raccourcie).
- Les licences n'ont pas été lues, la quantification n'a pas été relevée (valeur par défaut d'Ollama), les empreintes sont les identifiants courts d'Ollama et non des hash de fichiers GGUF.
- Le « PC de travail » de référence basse n'a pas été défini ; le CPU mesuré (Ryzen 7 7700X, 8 cœurs) est meilleur que la plupart des PC de bureau.

## 8. Décision

À compléter une fois les tests terminés. **Aucune décision prise** : les chiffres ci-dessus ne suffisent pas, en particulier à cause de la latence.

Constat provisoire (Claude, 3 nov. 2026) : aucun candidat ne passe le critère de latence sur 10 pages, même sur GPU (86 à 242 s contre 60 s fixés) ; en CPU seul, 10 pages prennent 14 à 33 minutes. Côté qualité, `qwen3.5:4b` (+56 points sur les indirects) et `ministral-3:3b` (+44) sont en tête ; `ministral-3:8b` rattache le mieux. Selon la procédure du §6 (étape 3), il faut soit lever le critère de latence en le consignant, soit revoir le traitement (morceaux plus petits, plafond de temps, LLM sur demande seulement), soit appliquer le repli de `DOCUMENTATION.md` §15.


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
