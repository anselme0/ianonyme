# DECISIONS.md — Choix faits en autonomie

Chaque entrée : le choix, les alternatives écartées, la raison.

## D1. pnpm via `corepack pnpm`
`corepack enable` exige les droits administrateur (EPERM). Choix : `corepack pnpm` (version fixée par `packageManager`). Écarté : installation globale de pnpm (logiciel hors projet).

## D2. Rangement du dossier
`docs/` pour les documents, `assets/logo/` pour les logos d'origine ; `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `README.md` restent à la racine. `corpus/` et `scripts/` ne bougent pas (les tests de modèle d'Anselme en dépendent).
