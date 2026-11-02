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
