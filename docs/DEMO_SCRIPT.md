# IAnonyme — Script de démonstration

> Parcours d'environ 4 minutes, avec le dossier fictif `demo/expertise-affaire-brunet.docx` (généré par `packages/desktop/scripts/make-demo-expertise.mjs`). Tout y est inventé : personnes, société, communes, numéros (téléphones dans les plages réservées à la fiction, IBAN et SIREN repris d'exemples publics).
> Les sorties citées viennent d'un essai du 4 novembre 2026 avec le serveur local (modèle servi par LM Studio, une seule copie pour l'analyse et pour les réponses). **Ce n'est pas une mesure** : le modèle n'est pas déterministe, les liens proposés varient d'une exécution à l'autre. Répéter le parcours avant le passage.

## 1. Ce que le parcours doit montrer

1. Un document Word réaliste (en-tête, pied de page, tableaux, liste, note de bas de page) est lu **sur le poste**.
2. Les informations directes sont protégées automatiquement ; les **cas difficiles** sont repérés par l'analyse approfondie : une même personne désignée de plusieurs façons, un lien de parenté, un nom de famille partagé par deux personnes.
3. L'utilisateur garde la main : il voit tout, il corrige d'un clic.
4. L'IA **répond à des questions sur des données qu'elle ne voit jamais**, et les vraies valeurs reviennent dans la réponse.

## 2. Le dossier

« Affaire Brunet c/ BÂTIRAVEL SAS » : désordres sur l'extension d'une maison, expertise judiciaire. Document court (environ une page et demie, 2 900 caractères) pour que l'analyse reste rapide (environ 8 secondes lors de l'essai). Les dates sont cohérentes : désordres en décembre 2025, réclamation en janvier 2026, ordonnance le 3 février 2026, réunions les 2 et 30 mars. Cas difficiles volontairement placés :

| Cas | Dans le document | Ce que l'application doit faire |
|---|---|---|
| Une personne, plusieurs désignations | **M. Jean Garnier**, « maire de Valmont-sur-Aure », « le premier magistrat de la commune », « l'édile » | Les rattacher à une seule personne (un seul repère) |
| Lien de parenté | « son beau-frère, M. Marc Delorme, sous-traitant de la société » | Rattacher « son beau-frère » à Marc Delorme (et non au gérant) |
| Nom de famille partagé | **Isabelle** et **Patrick Brunet**, « l'affaire Brunet », « M. Brunet », « Mme Brunet » | Prénoms distincts, **même repère de nom** : « l'affaire Brunet » reste compréhensible, aucun conflit à trancher ; la civilité distingue « M. » de « Mme » |
| Contexte à laisser | « l'architecte », « l'expert », dates, montants | Ne pas masquer |
| Données directes | téléphones, e-mails, IBAN, SIREN, adresses, date de naissance, numéros de dossier | Protégées par les règles |

## 3. Les deux questions et la question « associations »

| | Question à taper | Pourquoi |
|---|---|---|
| **Q1** | `Comment joindre le gérant de la société, et sur quel compte doit être versé le solde ?` | La réponse contient un nom, un téléphone, un IBAN que l'IA n'a jamais vus : elle ne voit que des repères, l'application restitue les vraies valeurs. |
| **Q2** | `Quel est le numéro de téléphone de la personne qui a réalisé les enduits ?` | **Recherche d'une donnée confidentielle** : l'IA doit retrouver la bonne personne dans le dossier (sous-traitant, enduits) pour désigner le bon repère de téléphone. |
| **Bonus** | `Récapitule toutes les interventions de M. Garnier, y compris celles où il n'est pas nommé.` | Montre l'intérêt des associations : « le premier magistrat », « l'édile » et « maire de Valmont-sur-Aure » portent le même repère, donc l'IA les regroupe sans savoir qui c'est. |

Réponses obtenues lors de l'essai (extraits) : Q1 donne le nom du gérant, son téléphone, son e-mail et l'IBAN ; Q2 donne le nom du sous-traitant et son numéro ; le bonus regroupe la présence aux réunions, l'absence de réserves de la commune et les services municipaux. La chronologie demandée à l'étape 2 est cohérente de bout en bout. Durée d'une réponse : environ 3 à 25 secondes selon la longueur (non chronométré sur l'installeur).

## 4. Parcours

| # | Action | Ce que le jury voit | Ce qu'on dit |
|---|---|---|---|
| 1 | Glisser `expertise-affaire-brunet.docx` dans la zone de saisie. | Une tuile de document, avec les étapes de lecture. Surlignage en direct dans la zone de saisie pour ce qu'on tape. **Aucun volet ne s'ouvre.** | « Le document est lu sur le poste. L'analyse tourne en arrière-plan, sans me déranger. » |
| 2 | Écrire `Établis la chronologie des faits, date par date.` puis cliquer **Vérifier**. | Le volet de vérification, avec deux onglets : le message et le document. Le texte est surligné par famille. | « Je vérifie avant d'envoyer. Un onglet par texte transmis. » |
| 3 | Dans le volet de droite, déplier **Personnes** : montrer **Jean Garnier** et ses sous-éléments (« maire de Valmont-sur-Aure », « premier magistrat de la commune », « L'édile »). Survoler l'un d'eux dans le document. | L'arborescence : un élément principal, ses autres désignations dessous. | « Le maire, le premier magistrat, l'édile : l'analyse a compris que c'est la même personne que Jean Garnier. Les règles seules ne le feraient pas. » |
| 4 | Montrer **Isabelle** et **Patrick Brunet** : « l'affaire Brunet », « M. Brunet », « Mme Brunet ». | Deux personnes, un nom partagé. Aucun point de vigilance. | « Deux personnes portent le même nom : le prénom et le nom sont protégés séparément, l'affaire Brunet reste lisible pour l'IA. » |
| 5 | Cliquer le commutateur **Ce que l'IA va recevoir**. | Le même texte, au même endroit, avec les mêmes couleurs : les éléments protégés passent à leur repère. Revenir sur **Votre texte**. | « Voilà exactement ce qui part. Même texte, mêmes couleurs. » |
| 6 | Faire une correction : cliquer la croix d'un élément (au survol dans le texte, ou dans la liste). Au besoin, retirer un faux positif éventuel. | L'élément n'est plus protégé. | « Tout est réversible avant l'envoi. » |
| 7 | **Envoyer** (depuis le volet). | La réponse s'écrit avec les vrais noms, soulignés en pointillés ; le document apparaît dans le message envoyé. | « La réponse contient les vrais noms : ils ont été restitués après coup. » |
| 8 | **Q1**, puis **Envoyer**. | Nom, téléphone et IBAN dans la réponse. Aucun volet ne s'ouvre. | « L'IA ne voit jamais ni le téléphone ni l'IBAN, et elle y répond : elle ne manipule que des repères. »  |
| 9 | **Q2**, puis **Envoyer**. | Le nom et le numéro du sous-traitant. | « Ici elle doit retrouver une information confidentielle : elle désigne le bon repère, l'application met la vraie valeur. » |
| 10 | **Bonus**, si le temps le permet. | La liste des interventions du maire, y compris sous ses autres désignations. | « Sans l'association faite par l'analyse, ces passages n'auraient aucun lien pour l'IA. » |

## 5. Avant de passer (fiche de contrôle)

- [ ] Installeur ou lancement `corepack pnpm --filter desktop dev` ; **serveur local démarré** (modèle chargé, contexte 8192 ou plus, accélération graphique complète) et joignable à l'adresse de `config/local.config.json`.
- [ ] `config/local.config.json` présent, **hors dépôt** ; `reasoningEffort` à `none` pour l'analyse (sinon l'analyse est beaucoup plus lente).
- [ ] Le volet Protection indique « Analyse approfondie sur votre ordinateur : active ».
- [ ] Une seule conversation, vide. Fenêtre en 1400 x 900 ou plein écran. Notifications coupées, console fermée.
- [ ] **Répéter le parcours en entier** : les liens proposés par le modèle varient. Si un lien attendu manque (par exemple « son beau-frère »), le montrer comme une correction possible plutôt que le cacher.
- [ ] Plan B : vidéo du parcours enregistrée sur la machine finale.

## 6. Ce qu'on dit, ce qu'on ne dit pas

- « Le produit **protège** : il propose, l'humain valide, le code bloque la fuite. »
- Le libellé de l'assistant dans la configuration de démonstration ne reflète pas forcément le modèle réellement branché. Si on vous demande quel modèle répond, dites ce qui est branché sur ce poste.
- Ne pas affirmer : conformité au RGPD ou au secret professionnel ; que le fournisseur de l'assistant ne conserve rien ; que la qualité des réponses est « équivalente » avec et sans masquage (à mesurer) ; que les comptes et le serveur existent (maquettes) ; des pourcentages de fiabilité sans citer la taille du corpus (petit, fictif).
- Les statistiques de détection se présentent à l'oral, hors application.

## 7. Limites connues, à savoir avant de les rencontrer

- **Variabilité du modèle** : d'une exécution à l'autre, un lien peut manquer (« son beau-frère ») ou un faux positif apparaître (par exemple « gérant » seul protégé). L'utilisateur corrige d'un clic.
- **Fonction rattachée à une personne** : la fonction reste lisible à côté du repère (« [repère] (le gérant) », « maire de [lieu] »), donc l'IA répond « Étienne Vasseur est le gérant de BÂTIRAVEL ». Une fonction qui contient un mot identifiant non protégé est remplacée en entier.
- **Désignations très vagues** (« l'adjointe au maire », « les services ») : à la discrétion du modèle.
- **Contexte long** : le modèle local lit le texte par morceaux de 2 000 caractères ; les liens entre morceaux éloignés peuvent être manqués.

## 8. Si quelque chose ne marche pas

| Symptôme | Cause probable | Action |
|---|---|---|
| « Analyse de base » dans le volet Protection | Serveur local arrêté ou injoignable | Démarrer le serveur ; sinon continuer : l'application fonctionne avec les règles seules et le dit. C'est aussi un point à montrer. |
| L'analyse ne se termine pas | Réflexion du modèle activée | Régler `reasoningEffort` à `none` dans `config/local.config.json`, relancer. |
| « L'assistant ne répond pas. Votre message n'a pas été perdu. » | Serveur local | Vérifier le serveur, relancer l'envoi. |
| Fichier refusé | PDF scanné, image | Le message est volontaire : montrer qu'il ne part rien. Utiliser le `.docx`. |
