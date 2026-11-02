# IAnonyme — Script de démonstration

> Parcours de 3 minutes, de `DOCUMENTATION.md` §13, tel qu'il a été déroulé de bout en bout par le test `packages/desktop/e2e/demo.spec.ts` (avec l'assistant de démonstration hors ligne). Les chiffres cités ci-dessous viennent de cette exécution : ils varieront avec un vrai modèle.
> Documents fictifs : `demo/rapport-expertise-fictif.docx` et `demo/rapport-expertise-fictif.pdf` (tout est inventé : personnes, société, commune, numéros ; générés par `packages/desktop/scripts/make-demo-docs.mjs`).

## 1. Deux façons de présenter, à dire clairement

| Configuration | Assistant | Analyse approfondie | À dire au jury |
|---|---|---|---|
| **A. Hors ligne** (testée) | « Assistant de démonstration (hors ligne) » : réponses scriptées | « simulée » : repère quelques formulations types | « L'assistant et l'analyse approfondie sont simulés dans cette démonstration ; la protection (repérage des règles, masquage, vérification, restitution) est réelle. » |
| **B. Réelle** (non testée) | Claude, clé dans `config/local.config.json` | Modèle local choisi après les tests de `MODELE_LOCAL_TESTS.md` | Seulement après l'avoir déroulée en entier sur l'installeur. |

Ne jamais présenter la configuration A comme une vraie intelligence artificielle ni comme une mesure de qualité des réponses.

## 2. Fiche de contrôle (avant chaque répétition)

- [ ] L'installeur utilisé est celui du commit de démonstration ; installé sur un **profil propre**, pas sur le poste de développement.
- [ ] `config/local.config.json` présent à l'emplacement prévu (`DEV_SETUP.md`, §6), **hors dépôt** ; aucune clé affichée à l'écran ni dans une capture.
- [ ] Configuration B seulement : plafond de dépense en place, réseau vérifié, modèle local préchargé (pas de téléchargement en direct), « Analyse approfondie sur votre ordinateur : active » visible dans le volet Protection.
- [ ] Une seule conversation, vide. Thème choisi. Fenêtre en 1400 x 900 ou plein écran.
- [ ] `demo/rapport-expertise-fictif.docx` accessible depuis le bureau (glisser-déposer).
- [ ] Console de développement fermée. Notifications du système coupées.
- [ ] Le parcours ci-dessous est déroulé en entier **sur l'installeur**, chronométré, avant le jury.
- [ ] Plan B prêt : vidéo du parcours enregistrée sur l'installeur final.
- [ ] Après la finale : clé API révoquée.

## 3. Parcours

| # | Action | Ce que le jury voit | Ce qu'on dit |
|---|---|---|---|
| 1 | Glisser `rapport-expertise-fictif.docx` dans la zone de saisie. | La pastille du fichier passe par « Lecture du document », « Repérage des informations sensibles », « Analyse approfondie ». La **revue plein écran** s'ouvre. | « Rien ne part sans avoir été masqué. Le document est lu sur le poste. » |
| 2 | Dans la revue : parcourir le document surligné par famille. Cliquer sur « Le maire de la commune ». | Quatre points à vérifier (configuration A) : « Le maire de la commune » avec la mention « Désigne probablement Louis Cordier », « Le gérant de la société » (deux fois), « son beau-frère ». Le bouton **Continuer** est inactif. | « Les noms, numéros et adresses sont protégés automatiquement. Les mentions indirectes sont **proposées** : c'est l'expert qui décide. » |
| 3 | Cliquer **Protéger** sur chaque ligne (ou touche `P`). | Le compteur passe à « 4 sur 4 vérifiés » ; **Continuer** devient actif. | « Chaque décision est visible et réversible avant l'envoi. » |
| 4 | **Continuer** puis l'onglet **Comparaison**. | À gauche le texte d'origine surligné, à droite le texte protégé avec les repères `[PERSONNE_4]`… | « Voici exactement ce que l'IA va recevoir : aucun nom, aucun numéro. » |
| 5 | **Retour**, cliquer le modèle « Chronologie des faits » (ou taper : `Établis la chronologie des faits.`), **Envoyer**, **Envoyer** dans l'aperçu. | La réponse s'écrit avec les vrais noms, soulignés en pointillés. Au survol : « Remplace [PERSONNE_4] ». | « La réponse contient les vrais noms : ils ont été restitués à partir des repères. » |
| 6 | Dans le volet Protection : onglet **Éléments protégés**, puis cliquer sur « Louis Cordier ». | La liste par famille, chaque valeur avec son repère ; ses occurrences surlignées dans la conversation. | « Les correspondances restent sur ce poste, en mémoire, effacées à la fermeture. » |
| 7 | Taper : `Que dit M. Louis Cordier ?` puis **Envoyer**. | Le compteur annonce « 1 élément sera protégé » ; un aperçu bref montre le **même repère** qu'au tour précédent. **Envoyer maintenant**. | « Même personne, même repère, sur toute la conversation. » |
| 8 | Taper : `Pierre Dupuis et Jacques Dupuis sont frères.` (envoyer), puis `Dupuis a signé hier.` | **Envoi bloqué : le nom Dupuis apparaît encore dans le message.** L'endroit est surligné ; le message reste dans la zone de saisie. | « Deux personnes portent ce nom : le système ne choisit pas à notre place, et il bloque. » |
| 9 | **Protéger**, puis **Choisir Pierre Dupuis** (ou l'autre), puis **Annuler** pour revenir. | La revue propose les deux candidats ; la valeur est tranchée. | « L'envoi reste bloqué tant que l'expert n'a pas choisi. » |
| 10 | Menu du bas de la barre latérale, **Fiabilité de la détection**. | Le tableau « Mesurée sur 6 documents fictifs », par famille, avec la note sur la petite taille du corpus. | Voir §4. |

Durée visée : 3 minutes. Les étapes 8 et 9 peuvent être raccourcies si le temps manque.

## 4. Ce qu'on dit de la mesure (et ce qu'on ne dit pas)

- « Mesuré sur 6 documents fictifs, dont 3 réservés à l'évaluation et jamais utilisés pour régler les règles. Sur un corpus aussi petit, ces pourcentages ne sont pas représentatifs d'un usage réel. »
- Les mentions **indirectes** (fonctions, liens de parenté) ne sont pas repérées par les règles : 0 % sans analyse approfondie, et le **gain de l'analyse approfondie n'est pas encore mesuré** (le modèle n'est pas choisi). L'écran le dit : « Non mesurée ».
- Ne pas affirmer : conformité au RGPD ou au secret professionnel ; que le fournisseur de l'assistant ne conserve rien ; que la qualité des réponses est « équivalente » avec et sans masquage ; que le compte et le serveur existent (maquette) ; que l'anonymisation d'images est prévue sans réserve (feuille de route). Voir `DOCUMENTATION.md`, §17.
- Le produit **protège** : il propose, l'humain valide, le code bloque la fuite. Il ne « garantit » rien.

## 5. Si quelque chose ne marche pas

| Symptôme | Cause probable | Action |
|---|---|---|
| « Analyse de base » dans le volet Protection | Modèle local absent, lent ou en erreur | Continuer : l'application fonctionne avec les règles seules et le dit. C'est aussi un point à montrer. |
| « L'assistant ne répond pas. Votre message n'a pas été perdu. » | Réseau ou clé | Choisir « Assistant de démonstration (hors ligne) » dans le sélecteur de l'en-tête, ou passer au plan B. |
| Fichier refusé | PDF scanné, image | Le message est volontaire : montrer qu'il ne part rien. Utiliser le `.docx` fictif. |
| L'installeur ne démarre pas | Antivirus, profil | Passer au poste de secours (32 Go, RTX 5070), ou à la vidéo. |
