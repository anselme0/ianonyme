# IAnonyme — Cahier de l'interface (UI/UX)

> Document de travail pour la démo du Challenge Projets d'Entreprendre 2026 (équipe 59).
> Il complète `DOCUMENTATION.md` (fonctionnel et technique) : ici, uniquement ce que voit et fait l'utilisateur.
> Date : 2 novembre 2026. Aucune implémentation n'est décrite ici, seulement ce qu'il faut concevoir et construire côté interface.

## Table des matières

1. [Principes directeurs](#1-principes-directeurs)
2. [Identité visuelle](#2-identité-visuelle)
3. [Structure de l'écran principal](#3-structure-de-lécran-principal)
4. [Parcours utilisateur](#4-parcours-utilisateur)
5. [Écran de revue](#5-écran-de-revue)
6. [Vocabulaire et messages](#6-vocabulaire-et-messages)
7. [Menus et paramètres](#7-menus-et-paramètres)
8. [États et cas limites](#8-états-et-cas-limites)
9. [Écran « Fiabilité de la détection »](#9-écran--fiabilité-de-la-détection-)
10. [Liste des éléments à construire](#10-liste-des-éléments-à-construire)
11. [Priorités d'ici mercredi](#11-priorités-dici-mercredi)
12. [Décisions prises et points à confirmer](#12-décisions-prises-et-points-à-confirmer)

---

## 1. Principes directeurs

**Se sentir en terrain connu.** L'interface reprend les codes des applications d'IA que l'utilisateur connaît déjà : conversations à gauche, fil de messages au centre, zone de saisie en bas, réponse qui s'écrit en continu. Aucun apprentissage pour discuter avec l'IA.

**Rendre visible ce qui nous distingue.** Dans un chat classique, il n'y a qu'une version du texte. Chez nous, il y en a deux : ce que l'expert voit, et ce que l'IA reçoit. Toute l'identité de l'interface repose sur cette dualité, et l'utilisateur doit pouvoir passer de l'une à l'autre en un geste. C'est ce qui rend la protection crédible, car elle se voit au lieu de se déclarer.

**Parler à un expert, pas à un développeur.** Aucun terme technique à l'écran (voir le glossaire, section 6). La transparence passe par des phrases claires : quoi, où, que faire.

**Sobre, dense, professionnel.** Pas de dégradés, de verre dépoli, d'ombres portées ni de coins très arrondis. Pas d'emojis. Une seule famille d'icônes en trait fin. Des bordures d'un pixel plutôt que des cartes ombrées. La couleur d'accent est utilisée avec parcimonie.

**Vouvoiement partout.** Ton neutre, phrases courtes, pas d'enthousiasme commercial.

**Ne jamais perdre le travail de l'utilisateur.** Un message bloqué reste dans la zone de saisie. Une revue interrompue peut être reprise.

**Ne pas se reposer sur la couleur seule.** Chaque état (protégé, à vérifier, bloqué) se distingue aussi par une icône ou un libellé. Toutes les actions de la revue sont utilisables au clavier.

## 2. Identité visuelle

### 2.1 Le logo

Le logo (fichier `assets/logo/logo.svg`) montre un document sur fond marine, avec un masque (type loup) sur sa partie haute et des lignes de texte en dessous. Deux lignes sont grises et une est verte : **la ligne verte représente l'information protégée**. Ce détail est notre motif signature : on le reprend dans l'interface (voir 2.4).

Le mot « IAnonyme » est écrit avec « IA » en vert et « nonyme » en marine.

Règles d'usage :
- Sur fond clair : logo tel quel.
- Sur fond sombre : le marine du mot « nonyme » devient blanc cassé ; l'icône garde son fond marine avec un fin liseré clair pour ne pas se fondre dans le fond.
- Taille minimale de l'icône seule : 24 px.
- Dans l'application, l'icône seule suffit (barre latérale, fenêtre). Le logo complet est réservé à l'écran de démarrage et à la fenêtre « À propos ».

### 2.2 Couleurs (à valider avec un contrôle de contraste)

Couleurs relevées dans le logo :

| Rôle | Valeur | Origine |
|---|---|---|
| Marine (fond, texte fort) | `#1B2A41` | logo |
| Vert (accent, « protégé ») | `#2E7D6B` | logo |
| Gris moyen | `#A9B4C4` | logo |
| Gris clair | `#C9D1DC` | logo |
| Blanc | `#FFFFFF` | logo |

Couleurs à déduire pour les deux thèmes (valeurs de départ, à ajuster) :

| Rôle | Thème clair | Thème sombre |
|---|---|---|
| Fond de l'application | blanc cassé légèrement chaud | marine très foncé (plus foncé que `#1B2A41`) |
| Fond des panneaux | gris très clair | marine `#1B2A41` ou proche |
| Bordures | gris clair `#C9D1DC` adouci | marine éclairci |
| Texte principal | marine `#1B2A41` | blanc cassé |
| Texte secondaire | gris bleuté foncé | gris `#A9B4C4` |
| Accent (bouton principal, focus, élément actif) | vert `#2E7D6B` | vert éclairci pour garder le contraste |

Couleurs d'état :

| État | Couleur | Usage |
|---|---|---|
| Protégé | vert du logo | pastille d'état, éléments protégés |
| À vérifier | ambre sourd | éléments en attente, compteur |
| Bloqué / erreur | rouge sourd | envoi bloqué, fichier refusé |

Le vert sert à la fois d'accent et d'état « protégé » : c'est voulu, parce que tout ce qui est vert dans l'application veut dire « tout va bien ». En contrepartie, **aucune famille d'informations ne doit utiliser du vert** (voir 2.4).

### 2.3 Typographie

- Texte d'interface et de conversation : une famille sans empattement sobre. Proposition : **IBM Plex Sans** (libre, lisible, moins vue que les polices par défaut).
- Repères (`[PERSONNE_1]`) et extraits techniques : **IBM Plex Mono**.
- Les polices doivent être **embarquées dans l'application** : elle doit fonctionner sans connexion à un service de polices.
- Corps de texte autour de 15 px, interligne généreux (environ 1,6) dans le fil de conversation, plus serré (environ 1,4) dans les listes et la revue.
- Hiérarchie par la taille et la graisse, jamais par la couleur seule.

### 2.4 Le motif signature : les pastilles d'information

Chaque information protégée est affichée sous forme de **pastille discrète**, de la couleur de sa famille. Cinq familles, pour que l'utilisateur n'ait pas à apprendre douze catégories :

| Famille affichée | Contenu (catégories du moteur) | Couleur de départ |
|---|---|---|
| Personnes | personne, fonction, lien de parenté | bleu ardoise |
| Organisations | organisation | violet grisé |
| Lieux | lieu, adresse | ocre |
| Coordonnées | e-mail, téléphone | brique |
| Numéros et références | IBAN, numéro de dossier, identifiant, date de naissance | gris bleu foncé |

Les teintes sont **désaturées**, avec un fond léger et un texte contrasté, pour ne pas faire sapin de Noël sur un document dense. Elles sont définies pour les deux thèmes, et leur contraste est vérifié dans chacun.

La même information apparaît sous trois formes selon le contexte :

| Contexte | Ce qui s'affiche |
|---|---|
| Dans la zone de saisie ou le document à relire | la valeur réelle, surlignée de la couleur de sa famille |
| Dans « Ce que l'IA va recevoir » | le repère, en police mono (par exemple `[PERSONNE_1]`) |
| Dans la réponse de l'IA | la valeur réelle restituée, soulignée en pointillés ; au survol : « Remplace [PERSONNE_1] » |

Motif complémentaire : dans les états vides et l'écran de démarrage, on reprend les **lignes grises du logo avec une ligne verte** comme illustration discrète. Elle remplace tout visuel décoratif.

### 2.5 Formes et espacement

- Rayon des coins : 6 px au maximum, 4 px pour les pastilles.
- Bordures d'un pixel, pas d'ombres, sauf un léger contour pour les menus déroulants et fenêtres modales.
- Grille d'espacement sur un pas de 4 px.
- Colonne de lecture du fil de conversation : environ 720 px de large, centrée.
- Icônes : une seule famille en trait fin (Lucide ou Phosphor), 16 ou 20 px.

### 2.6 Thèmes

Clair, Sombre, ou Selon l'ordinateur. Toutes les couleurs sont définies comme variables dès le départ, pour les deux thèmes. Le point de vigilance est le **surlignage par famille** : le vérifier sur fond clair et sur fond sombre, et sur le texte courant comme sur le texte en gras.

## 3. Structure de l'écran principal

```
+--------------------+----------------------------------+--------------------+
|  [icône] IAnonyme  |  Titre de la conversation        |  PROTECTION        |
|                    |  Assistant : Claude         [..] |  ---------------   |
|  + Nouvelle        |                                  |  12 protégés       |
|    conversation    |                                  |  2 à vérifier      |
|                    |   Vous                           |                    |
|  Aujourd'hui       |   Message avec Jean Garnier ...  |  Personnes (3)     |
|   > Dossier RG...  |                                  |   Jean Garnier     |
|     Expertise ...  |   Assistant                      |   ...              |
|                    |   Réponse restituée ...          |  Lieux (2)         |
|                    |                                  |   ...              |
|                    |  +----------------------------+  |  [Ce que l'IA va   |
|  ----------------  |  | Écrivez votre message      |  |   recevoir]        |
|  Anselme       [..]|  | [trombone]          [Envoyer]|  |  ---------------   |
|                    |  +----------------------------+  |  Analyse approfondie|
+--------------------+----------------------------------+  active            |
                                                         +--------------------+
```

### 3.1 Barre latérale (gauche)

- Icône de l'application et bouton **Nouvelle conversation**.
- Liste des conversations, groupées par jour. Survol : renommer, supprimer.
- En bas : le nom de l'utilisateur (« Anselme ») et l'accès aux paramètres.
- Repliable pour libérer de la place sur un petit écran.

### 3.2 Conversation (centre)

- En-tête : titre de la conversation (modifiable) et sélecteur d'assistant.
- Fil de messages avec rendu Markdown (listes, tableaux, code).
- Sous chaque réponse : **Copier**, **Régénérer** ; pendant l'écriture : **Arrêter**.
- Zone de saisie en bas : champ multiligne, trombone pour joindre un fichier, bouton Envoyer. Le surlignage des informations sensibles se fait **dans le champ lui-même**, pendant la frappe.
- Sous le champ, une ligne discrète : « 3 éléments seront protégés dans ce message ».

### 3.3 Volet Protection (droite, permanent)

Toujours visible, ouvert par défaut, repliable. C'est notre élément distinctif. Trois blocs :

1. **État.** Une ligne : « 12 éléments protégés dans cette conversation » (vert), ou « 2 à vérifier » (ambre). Un clic ouvre la revue.
2. **Éléments protégés.** Liste groupée par famille (Personnes, Organisations, Lieux, Coordonnées, Numéros et références). Chaque ligne montre la valeur réelle et son repère. Un clic sur une ligne surligne ses occurrences dans la conversation.
3. **Ce que l'IA va recevoir.** Onglet qui affiche le texte exact qui sera envoyé : repères visibles, rien en clair. Il se met à jour pendant la frappe.

En bas du volet, une ligne d'état : « Analyse approfondie sur votre ordinateur : active » ou « Analyse de base » (voir 8.1).

Sous cette ligne, un interrupteur **« Analyser aussi les messages »**, par conversation, **activé par défaut** (`DOCUMENTATION.md`, §11). L'analyse s'exécute après le clic sur Envoyer, avec un indicateur de progression. Une phrase l'explique : « Analyse vos messages avant l'envoi. Désactivez-la pour envoyer plus vite. » Grisé en Analyse de base.

Pourquoi un volet permanent et non une fenêtre qui apparaît : en démonstration, le jury voit à la fois la réponse de l'IA et ce qui a été réellement envoyé, sans manipulation.

## 4. Parcours utilisateur

### 4.1 Premier lancement

Écran de démarrage avec le logo, puis préparation de l'analyse approfondie : « Préparation de l'analyse sur votre ordinateur », avec barre de progression et vérification d'intégrité mentionnée en une ligne. Si le téléchargement échoue ou prend trop de temps : bouton **Continuer avec l'analyse de base**, avec une phrase qui dit ce que cela change.

### 4.2 Conversation vide

Titre sobre (« Par quoi commençons-nous ? »), zone de saisie, zone de dépôt de fichiers. Dessous, trois **modèles de tâches** en lignes de liste simples : résumé de dossier, chronologie des faits, relevé de contradictions. Un clic remplit la zone de saisie avec une consigne modifiable. Rien d'autre.

### 4.3 Message court (voie rapide)

1. L'expert tape ou colle du texte. Les informations sensibles sont surlignées en direct.
2. Un compteur indique combien d'éléments seront protégés.
3. Au clic sur **Vérifier**, l'analyse approfondie s'exécute (indicateur de progression) et **décide elle-même** ce qui est protégé : un métier générique (« l'architecte ») reste lisible par l'IA, « le maire de Saint-Cloud » est protégé, et les liens entre mentions sont proposés par l'analyse. Rien n'interrompt la rédaction avant ce clic.
4. Si des éléments sont protégés ou ambigus, le volet de vérification s'ouvre : l'utilisateur peut tout corriger (**Ne plus protéger**, protéger une sélection, trancher un cas ambigu). Sinon, un **aperçu bref** (quelques secondes, annulable) montre le message tel que l'IA le recevra, puis le message part.

Cette voie correspond au mode de validation hybride décidé (`DOCUMENTATION.md`, §9). L'utilisateur peut vérifier ce qui part à chaque envoi. Un mode invisible (sans aperçu) pourra être envisagé plus tard ; il n'est pas prévu dans la démo.

### 4.4 Import d'un fichier (voie vigilante)

1. L'expert glisse un fichier ou utilise le trombone (`.txt`, `.docx`, PDF avec texte).
2. Une pastille de fichier apparaît avec des étapes visibles : « Lecture du document », « Repérage des informations sensibles », « Analyse approfondie ».
3. Les avertissements éventuels s'affichent ici : commentaires non lus, images ignorées, pages sans texte.
4. Un PDF scanné ou une image est **refusé avec un message clair** (voir 8.2), jamais ignoré en silence.
5. Le nom du fichier est traité comme du texte sensible : il n'apparaît jamais en clair dans ce que reçoit l'IA.
6. L'analyse approfondie protège d'office ce qu'elle juge identifiant, en arrière-plan. La **revue plein écran** ne s'ouvre qu'au clic sur **Vérifier** (section 5), jamais d'elle-même pendant que l'utilisateur rédige.

### 4.5 Aperçu avant envoi

Après la revue ou sur demande depuis le volet, deux vues au choix :

- **Texte reçu par l'IA** : le texte exact, avec les repères.
- **Comparaison** : à gauche le texte d'origine, à droite le texte protégé, les éléments remplacés étant mis en évidence.

Bouton principal : **Envoyer**. Le bouton est actif tant que la vérification de sécurité passe.

### 4.6 Envoi bloqué

Si la vérification de sécurité trouve une information non protégée, l'envoi est bloqué :

- bandeau rouge sobre au-dessus de la zone de saisie : « Envoi bloqué : le nom *Garnier* apparaît encore dans le message. Protégez-le ou supprimez-le pour continuer. » ;
- l'endroit est surligné dans le message ;
- boutons **Protéger** et **Modifier le message** ;
- le message reste dans la zone de saisie.

C'est un temps fort de la démo : il montre que le système empêche réellement la fuite.

### 4.7 Réponse de l'IA

- La réponse s'écrit en continu, avec les valeurs déjà restituées. Un repère incomplet n'apparaît jamais à l'écran (voir `DOCUMENTATION.md`, §11).
- Les valeurs restituées sont soulignées en pointillés. Au survol : « Remplace [PERSONNE_1] ».
- Un petit message, une fois par conversation : « Les noms soulignés ont été restitués à partir des repères reçus par l'IA. »
- Si l'IA a modifié ou inventé un repère, une pastille ambre l'indique sur le passage concerné : « Un repère n'a pas pu être remplacé. »

### 4.8 Tour suivant

L'expert écrit directement un nom déjà rencontré. Il est surligné comme les autres et reçoit **le même repère** qu'au tour précédent. Au survol de la pastille, une info-bulle rappelle : « Même personne que dans les messages précédents. »

### 4.9 Parcours de démonstration (3 minutes)

Il suit `DOCUMENTATION.md`, §13. Les écrans nécessaires, dans l'ordre :

1. Fil de conversation avec import d'un rapport fictif.
2. Revue plein écran : traitement d'une suggestion (« le maire de la commune » relié à M. Garnier).
3. Onglet « Ce que l'IA va recevoir ».
4. Réponse (chronologie des faits) avec valeurs restituées.
5. Message de suivi avec le même repère.
6. Envoi bloqué, puis écran « Fiabilité de la détection ».

## 5. Écran de revue

Il s'ouvre en **plein écran**, au-dessus de la conversation. C'est l'écran le plus important du prototype : il concentre la vigilance humaine là où le risque est le plus élevé.

### 5.1 Disposition

```
+----------------------------------------------------------------------+
|  Vérifier avant d'envoyer — rapport-expertise.docx     3 sur 5 vérifiés |
+------------------------------------------+---------------------------+
|                                          |  À VÉRIFIER (2)           |
|  Document (texte surligné)               |  ● « le maire de la       |
|                                          |    commune »              |
|  ...M. [Garnier], [maire de la commune]  |    Suggéré par l'analyse  |
|  a signé le 12 mars à [Lyon]...          |    approfondie            |
|                                          |    [Protéger] [Ignorer]   |
|                                          |    [Relier à...]          |
|                                          |                           |
|                                          |  PROTÉGÉ AUTOMATIQUEMENT  |
|                                          |   Personnes (2)           |
|                                          |   Lieux (1) ...           |
+------------------------------------------+---------------------------+
|  [Annuler]                          [Voir ce que l'IA va recevoir]   |
|                                                       [ Continuer ]  |
+----------------------------------------------------------------------+
```

### 5.2 Contenu

- **Colonne gauche : le document**, avec les éléments surlignés par famille. Un clic sur un surlignage sélectionne la ligne correspondante à droite, et inversement.
- **Colonne droite, deux listes** :
  - **À vérifier** : suggestions de l'analyse approfondie, conflits. Chaque ligne indique l'origine en langage simple :
    - « Repéré automatiquement »
    - « Variante de M. Garnier »
    - « Suggéré par l'analyse approfondie »
  - **Protégé automatiquement** : éléments déjà acceptés (par les règles ou par l'analyse approfondie), groupés par famille, dépliés, chacun avec **Ne plus protéger**.
- **Actions sur chaque ligne à vérifier** : **Protéger**, **Ignorer**, **Relier à…** (rattacher à un élément existant). Pour ajouter à la main : sélectionner un texte dans le document, puis un petit menu propose **Protéger cet élément**.
- **Conflits** (deux personnes de même nom de famille, par exemple) : signalés en ambre avec la phrase « Plusieurs personnes peuvent correspondre. Choisissez. » Ils ne sont **jamais fusionnés automatiquement**.
- **Compteur** en haut : « 3 sur 5 vérifiés ». Le bouton **Continuer** reste inactif tant qu'il reste des points à traiter, avec une info-bulle qui explique pourquoi.
- **Raccourcis clavier** : touche pour protéger, touche pour ignorer, flèches pour passer à la ligne suivante, afin de traiter rapidement un document dense.
- **Sortie** : Annuler ramène à la conversation sans rien envoyer ; le travail de revue déjà fait est conservé.

### 5.3 Revue courte en ligne

Pour un message court avec une ou deux suggestions, la même logique s'affiche **dans le fil de conversation**, sous la zone de saisie : une ligne par suggestion avec les trois actions. Pas de plein écran pour deux clics.

## 6. Vocabulaire et messages

### 6.1 Glossaire (ce que l'utilisateur lit)

| Dans la documentation technique | À l'écran |
|---|---|
| API, Claude via API | « l'assistant IA » |
| Ce qui part à l'API | **Ce que l'IA va recevoir** |
| Placeholder `[PERSONNE_1]` | un **repère** |
| Entités, mentions | éléments, informations à protéger |
| Masquer / démasquer | protéger / restituer |
| Suggestions du LLM | **À vérifier** |
| Source `regex` | « Repéré automatiquement » |
| Source `variant` | « Variante de M. Garnier » |
| Source `llm` | « Suggéré par l'analyse approfondie » |
| LLM local actif | « Analyse approfondie sur votre ordinateur : active » |
| Mode dégradé | « Analyse de base » |
| Contrôle anti-fuite | **Vérification de sécurité** |
| Rappel par catégorie | « Part des informations repérées » |
| Anomalie de restauration | « Un repère n'a pas pu être remplacé » |
| Table de correspondance | « correspondances » (jamais affichée) |
| Session | « conversation » |

Mots à ne jamais afficher : API, LLM, regex, token, modèle quantifié, JSON, placeholder, pseudonymisation, anonymisation (voir note ci-dessous).

**Note sur « anonymisation ».** Le produit s'appelle IAnonyme, mais l'interface parle de **protéger** les informations. Raison : la question juridique de savoir si ces données sont « anonymes » au sens du RGPD est ouverte (`DOCUMENTATION.md`, §16 et §17). L'interface ne doit pas affirmer plus que ce qui est établi.

### 6.2 Messages types

| Situation | Message |
|---|---|
| Envoi bloqué | « Envoi bloqué : le nom *Garnier* apparaît encore dans le message. Protégez-le ou supprimez-le pour continuer. » |
| Analyse de base | « Analyse de base : l'analyse approfondie n'est pas disponible. Les noms, numéros et coordonnées sont protégés, mais certaines mentions indirectes (fonctions, liens de parenté) peuvent ne pas être repérées. » |
| PDF scanné | « Ce PDF est une image : il n'est pas possible d'en lire le texte pour le protéger. Il n'a pas été envoyé. » |
| Image | « Les images ne sont pas prises en charge pour le moment. Elles n'ont pas été envoyées. » |
| Commentaires non lus | « Ce document contient des commentaires ou des révisions qui n'ont pas été lus. Ils ne seront pas envoyés. » |
| Repère altéré | « Un repère n'a pas pu être remplacé dans cette réponse. » |
| Fin de conversation | « Les correspondances sont effacées à la fermeture de l'application. » |
| Assistant injoignable | « L'assistant ne répond pas. Votre message n'a pas été perdu. Réessayez. » |

Règle d'écriture : dire **où** (surligner), **quoi** (le nom exact), **que faire** (une action).

## 7. Menus et paramètres

Accès par le nom de l'utilisateur en bas de la barre latérale. Quatre rubriques seulement.

### 7.1 Assistant IA

Liste courte :
- **Claude (service en ligne)** — valeur par défaut.
- **Modèle hébergé sur le poste de démonstration** — seulement si configuré.

Rien d'autre n'est affiché : ni adresse, ni clé, ni nom technique de modèle. Un fournisseur non configuré n'apparaît pas dans la liste. La configuration est décrite dans `DOCUMENTATION.md`, annexe A.7.

Côté équipe : l'appel à l'assistant est écrit de façon générique (une interface d'appel unique, avec un adaptateur par fournisseur) pour pouvoir passer de Claude à un modèle auto-hébergé sans toucher à l'interface. La clé et l'adresse restent dans le fichier de configuration local de la démo (`DOCUMENTATION.md`, §5 et §10).

### 7.2 Données

- Bouton **Effacer cette conversation et ses correspondances**.
- Une phrase : « Tout est effacé à la fermeture de l'application. »

### 7.3 Apparence

Clair, Sombre, Selon l'ordinateur.

### 7.4 Compte

Nom d'utilisateur fictif **« Anselme »**, avec un nom de cabinet fictif et une adresse e-mail fictive. Boutons factices (Se déconnecter, Modifier le profil). Aucune connexion réelle.

Voir 12 pour la décision sur la mention « maquette ».

## 8. États et cas limites

### 8.1 Analyse de base

- Pastille ambre dans le volet Protection : « Analyse de base ».
- Lien « En savoir plus » : deux phrases qui expliquent la différence.
- Dans la revue, aucune suggestion « à vérifier » n'apparaît puisque l'analyse approfondie est absente ; un message l'explique.

### 8.2 Fichier refusé ou partiel

| Cas | Comportement |
|---|---|
| PDF sans couche de texte | Refus avec message clair, rien n'est envoyé |
| PDF avec quelques pages sans texte | Avertissement avec numéros de page |
| Image ou capture | Refus avec message clair |
| `.docx` avec commentaires ou révisions | Avertissement, contenu non lu et non envoyé |
| Encodage illisible | Refus avec message |
| Fichier trop volumineux | Refus avec message (limite à fixer après les tests) |

### 8.3 Analyse approfondie lente

Indicateur de progression sur la pastille de fichier. Option **Passer en analyse de base** pour ne pas bloquer l'utilisateur.

### 8.4 Changement de conversation

Chaque conversation a ses propres correspondances. Le volet Protection se met à jour à chaque changement.

### 8.5 Génération arrêtée

Le texte déjà reçu reste affiché, restitué ; le dernier repère incomplet est retiré.

### 8.6 Aucune information détectée

Message neutre : « Aucune information sensible repérée dans ce message. Vérifiez qu'il n'en contient pas avant d'envoyer. » Le bouton Envoyer reste actif ; un message sans information détectée n'est pas une erreur.

## 9. Écran « Fiabilité de la détection »

Accessible depuis le menu (rubrique réservée à la démonstration).

- Titre : **Fiabilité de la détection**.
- En-tête obligatoire : « Mesurée sur [N] documents fictifs ». La note sur la petite taille du corpus reste visible (`DOCUMENTATION.md`, §12).
- Tableau par famille d'informations : part repérée automatiquement, part repérée avec l'analyse approfondie, et gain apporté par l'analyse approfondie. Les mentions directes (nom, numéro) et indirectes (fonction, lien de parenté) sont séparées.
- Indicateurs complémentaires : informations restées visibles dans le texte envoyé, nombre moyen de suggestions rejetées par document.
- Aucune extrapolation, aucun pourcentage global présenté comme représentatif d'un usage réel.
- Pas de graphique décoratif : un tableau lisible suffit.

## 10. Liste des éléments à construire

| Élément | Où | Remarque |
|---|---|---|
| Tokens de couleur, typographie, espacement (clair et sombre) | Partout | À faire en premier |
| Barre latérale et liste de conversations | Écran principal | |
| Fil de messages avec rendu Markdown | Écran principal | |
| Zone de saisie avec surlignage en direct | Écran principal | Détection instantanée seulement |
| Pastilles d'information par famille | Partout | Composant central |
| Volet Protection (état, liste, « Ce que l'IA va recevoir ») | Écran principal | Composant distinctif |
| Restitution visible dans les réponses (soulignement, info-bulle) | Fil de messages | |
| Revue plein écran | Import de fichier | Le plus important |
| Revue courte en ligne | Message court | |
| Bandeau d'envoi bloqué | Zone de saisie | Temps fort de la démo |
| Pastille de fichier avec étapes | Zone de saisie | |
| Écran de démarrage et préparation de l'analyse | Premier lancement | |
| Paramètres (quatre rubriques) | Menu | Compte factice |
| Écran « Fiabilité de la détection » | Menu démo | |
| Messages d'état et d'erreur (section 6.2) | Partout | Une seule source de textes |
| Modèles de tâches (trois) | Conversation vide | Deuxième passe |
| Icône d'application et fenêtre « À propos » | Application | |

## 11. Priorités d'ici mercredi

Le prototype est attendu mercredi 4 novembre. Le temps est court : on construit d'abord ce que le jury voit et ce qui porte la démonstration.

**Première passe (indispensable)**
1. Tokens de couleur et de typographie, thème clair puis sombre.
2. Écran principal : conversation, zone de saisie avec surlignage, volet Protection.
3. « Ce que l'IA va recevoir ».
4. Revue plein écran.
5. Restitution visible dans les réponses.
6. Envoi bloqué.
7. Écran « Fiabilité de la détection ».

**Deuxième passe (si le temps le permet)**
- Revue courte en ligne (à défaut : la revue plein écran sert aussi aux messages courts).
- Modèles de tâches.
- Renommage et suppression de conversations.
- Écran de démarrage soigné et fenêtre « À propos ».
- Paramètres complets et compte factice.

**À ne pas faire pour la démo**
- Personnalisation de la couleur d'accent, de la police ou de la densité.
- Animations élaborées.
- Écrans de création de compte, de paiement ou de partage.
- Version mobile ou navigateur.

## 12. Décisions prises et points à confirmer

### Décidé

- Revue **plein écran** pour les fichiers.
- Volet Protection **permanent**.
- Thème **clair et sombre** au choix de l'utilisateur.
- Interface sans vocabulaire technique, au vouvoiement.
- Paramètres : Assistant IA, Données, Apparence, Compte. Pas de rubrique « Protection » (l'état de l'analyse approfondie est dans le volet Protection).
- Assistant : Claude, avec possibilité d'un modèle auto-hébergé pour la démo, via un appel générique.
- Clé API stockée uniquement côté poste de démonstration, jamais affichée.
- Compte factice « Anselme ».

### À confirmer

1. **Mention « maquette »** sur les écrans de compte. Proposition : rien d'affiché dans l'interface (pour un rendu réaliste), mais le point est dit à l'oral et figure sur le schéma « prototype vs produit » (`DOCUMENTATION.md`, §3 et §17). À valider par l'équipe, car il ne faut pas laisser croire au jury que le compte existe.
2. **Nom du cabinet et e-mail fictifs** du compte de démonstration.
3. **Polices** : IBM Plex proposée, à confirmer (licence libre, à embarquer).
4. **Couleurs des cinq familles** : valeurs de départ à tester sur documents réels de la démo, dans les deux thèmes.
5. **Contrastes** : vérification de chaque couleur de surlignage, sur fond clair et sombre.
6. **Libellé « Analyse approfondie »** : à tester auprès d'une personne extérieure à l'équipe pour vérifier qu'il est compris sans explication.
7. **Limites chiffrées** (taille de fichier, délai de l'analyse approfondie) : à fixer après les tests de modèle (`MODELE_LOCAL_TESTS.md`).
8. **Textes juridiques** : toute phrase de l'interface qui parlerait de confidentialité ou de conformité doit être relue (`DOCUMENTATION.md`, §17). Les messages de la section 6.2 évitent volontairement toute affirmation de ce type.

---

## Révision du 3 novembre 2026 (remplace ce qui est contraire plus haut)

- **Deux boutons d'envoi.** « Vérifier » ouvre le volet de vérification avant l'envoi. « Envoyer » fait les mêmes vérifications sans les afficher ; le volet ne s'ouvre que s'il reste un doute (point de vigilance).
- **Analyse approfondie en continu.** Elle tourne en arrière-plan pendant la frappe et à l'import, et le surlignage suit. Les boutons restent cliquables pendant l'analyse et rien n'est bloqué : « Vérifier » ouvre le volet tout de suite et les résultats de l'analyse s'y ajoutent à mesure (l'envoi depuis le volet reste inactif tant qu'elle n'est pas finie) ; « Envoyer » est mis en attente et part tout seul à la fin de l'analyse, avec une option pour annuler. Il n'y a plus de « Passer en analyse de base » : la protection doit être complète avant tout envoi.
- **« Ce que l'IA va recevoir »** : plus d'aperçu bref, de fenêtre de comparaison ni d'onglet dans le volet Protection. Seul reste, dans le volet de vérification, un commutateur « Votre texte | Ce que l'IA va recevoir » : le texte reste au même endroit avec les mêmes couleurs, et seuls les éléments protégés passent de leur valeur à leur repère (la valeur d'origine s'affiche au survol). La vérification de sécurité finale est inchangée.
- **Plus de réglage « Analyser aussi les messages »** : tout est analysé. Plus d'entrée « Fiabilité de la détection » dans le menu : les statistiques se présentent à l'oral.
- **Volet de vérification à onglets** : un onglet pour le message, un par document. « Envoyer » s'active quand plus aucun point n'est à traiter. À la sélection d'un texte, on peut le relier à un élément existant.
- **Documents en tuiles** (nom entier, deux lignes au plus), dans la zone de saisie et dans le message envoyé.
- **Volet Protection** : pas de repères entre crochets ; liste par famille, nom principal puis variantes en sous-liste indentée.
- **Ambiguïtés** : tranchées d'office par le modèle local quand le contexte le permet ; sinon point de vigilance dans le volet.
- **Document Word dans le volet de vérification** : un fichier `.docx` s'affiche comme dans Word (pages, en-tête et pied de page, tableaux, polices), avec le même surlignage, la même croix au survol et le même commutateur « Votre texte | Ce que l'IA va recevoir ». Les autres fichiers gardent l'affichage en texte.
