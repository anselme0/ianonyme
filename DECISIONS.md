# DECISIONS.md — Choix faits en autonomie

Chaque entrée : le choix, les alternatives écartées, la raison.

## D1. pnpm via `corepack pnpm`
`corepack enable` exige les droits administrateur (EPERM). Choix : `corepack pnpm` (version fixée par `packageManager`). Écarté : installation globale de pnpm (logiciel hors projet).

## D2. Rangement du dossier
`docs/` pour les documents, `assets/logo/` pour les logos d'origine ; `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `README.md` restent à la racine. `corpus/` et `scripts/` ne bougent pas (les tests de modèle d'Anselme en dépendent).

## D3. Détection : rattachement et fusion des entités
Une règle (ex. « Marc Moreau ») qui chevauche la variante d'une entité (« Moreau » d'Isabelle Moreau) n'y est rattachée que si les prénoms sont compatibles ; sinon une nouvelle entité est créée. Les formes les plus longues sont acceptées d'abord (la forme avec « SAS » crée l'entité, « Société DUCRET FRÈRES » s'y rattache). Écarté : fusionner par nom de famille seul (confond des homonymes, contraire à B.2).

## D4. Valeur ambiguë : non masquée, donc bloquante
Quand « Dupuis » désigne deux personnes, le moteur ne choisit pas : il ne masque pas, `checkLeak` bloque l'envoi, l'utilisateur tranche (`linkMention`). Écarté : masquer avec le premier repère (fusion silencieuse interdite par B.2) ; laisser passer (fuite).

## D5. Rappel avant précision pour les règles
Civilités, prénoms connus et initiales créent des personnes automatiquement acceptées ; les faux positifs se rejettent à la revue (`rejectMention`). Liste de prénoms écrite à la main (aucune source externe).

## D6. Restaurateur en flux
Un fragment commençant par `[` est retenu seulement s'il peut encore devenir un repère (lettres, chiffres, `_`, espace, tiret, 41 caractères au plus). Un crochet ordinaire (lien Markdown) est donc libéré dès qu'un caractère impossible arrive. Testé en coupant le texte à chaque position, une et deux coupures.

## D7. Corpus : aucun ajout dans `corpus/` pendant la nuit
Les tests Ollama d'Anselme parcourent `corpus/`. Ajouter des documents y fausserait leurs mesures. Les documents de démonstration (rapport fictif en `.docx` et PDF) vont dans `demo/`. À reporter dans `corpus/` après les tests de modèle si l'équipe le souhaite.

## D8. Commits : jamais `git add -A`
Les résultats des tests de modèle (`scripts/results/`) changent pendant la nuit sans que je les touche. Chaque commit liste ses chemins.

## D9. Pile de l'application
`electron-vite` 6 (configuration courte, trois builds : principal, préchargement, interface), React sans bibliothèque de composants (l'interface est sobre et sur mesure, `UI_UX.md` §2), icônes Lucide, polices `@fontsource` (IBM Plex, embarquées), Markdown par `react-markdown`. Écarté : Electron Forge (plus de configuration pour le même résultat), configuration Vite manuelle.

## D10. Extraction des fichiers
`.docx` : `fflate` + lecture du XML. `mammoth` n'extrait ni en-têtes ni pieds de page, que `DOCUMENTATION.md` §6 exige. PDF : `unpdf` (pdf.js empaqueté pour Node, aucune configuration de worker). Les images intégrées d'un PDF ne sont pas détectées (limite notée) ; celles d'un `.docx` le sont.

## D11. Faux assistant et faux LLM local
Le faux assistant (`type: fake`) et le faux LLM (`engine: fake`) servent aux tests et à la démonstration hors ligne. L'interface les présente comme tels (« Assistant de démonstration (hors ligne) », « Analyse approfondie simulée »). Ils ne comprennent rien : le faux LLM repère quelques formulations types. À ne jamais présenter au jury comme une vraie analyse.

## D12. La détection instantanée n'enregistre rien
Une frappe ne doit pas créer d'entité durable ni brûler de numéros de repères. `detect:run` travaille sur une copie de l'état ; l'enregistrement (`commit`) a lieu à l'ouverture de la revue, quand l'utilisateur décide, et à l'envoi.

## D13. Restitution : jetons inertes, pas de séparateurs dans le Markdown
Les valeurs restituées sont remplacées par un jeton alphanumérique avant l'analyse Markdown, puis réinsérées soulignées. Raison : `remark-gfm` transforme les e-mails en liens et coupait les séparateurs ; une valeur contenant `**` ne doit pas non plus déformer la mise en page. Testé.

## D14. Empaquetage
`electron-builder` ; `node-llama-cpp` dépaqueté de l'archive `asar` ; variantes CPU et Vulkan gardées, CUDA exclu (plus de 500 Mo). Installeur `nsis` d'environ 180 Mo. Modules installés à plat (`nodeLinker: hoisted`). L'installeur n'a pas été installé sur le poste (cela écrit dans le registre et le menu Démarrer) : son contenu a été extrait avec `7za` et l'exécutable extrait a passé le test de bout en bout.

## D15. Suggestions non acceptées : non masquées
Conforme à `DOCUMENTATION.md` A.4 : seules les entités acceptées sont masquées. Une suggestion ignorée part donc en clair, par choix de l'utilisateur. La revue est obligatoire quand le LLM propose quelque chose (mode hybride), pour que cela reste un choix éclairé.

## D16. Nom de fichier lisible
Le nom du fichier est placé dans le message sous une forme « ouverte » (`_` et `.` en espaces, casse mixte séparée), sinon `rapport_Jean_Garnier.docx` n'est pas reconnu : `_` est un caractère de mot pour les frontières. Le `_` est aussi traité comme un espace à la normalisation.

## D17. Revue des messages courts
Première passe : la revue plein écran sert aussi aux messages courts avec suggestion ou conflit ; sans suggestion, un aperçu bref (3 s, annulable) précède l'envoi. La revue en ligne (§5.3) est de la deuxième passe.

## D18. Envoi bloqué par ambiguïté
La démonstration du blocage repose sur deux personnes de même nom de famille : la valeur ambiguë n'est pas masquée, donc bloquante, jusqu'au choix de l'utilisateur.
