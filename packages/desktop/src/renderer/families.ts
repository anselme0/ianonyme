// Les douze catégories du moteur sont présentées en cinq familles (docs/UI_UX.md, §2.4).
import type { Category } from 'engine';

export type FamilyId = 'personnes' | 'organisations' | 'lieux' | 'coordonnees' | 'numeros';

export const FAMILY_ORDER: FamilyId[] = ['personnes', 'organisations', 'lieux', 'coordonnees', 'numeros'];

export const FAMILY_OF: Record<Category, FamilyId> = {
  PERSONNE: 'personnes',
  FONCTION: 'personnes',
  LIEN_PARENTE: 'personnes',
  ORGANISATION: 'organisations',
  LIEU: 'lieux',
  ADRESSE: 'lieux',
  EMAIL: 'coordonnees',
  TELEPHONE: 'coordonnees',
  IBAN: 'numeros',
  NUM_DOSSIER: 'numeros',
  IDENTIFIANT: 'numeros',
  DATE_NAISSANCE: 'numeros',
};

/** Catégorie utilisée quand l'utilisateur protège un texte à la main dans une famille. */
export const DEFAULT_CATEGORY: Record<FamilyId, Category> = {
  personnes: 'PERSONNE',
  organisations: 'ORGANISATION',
  lieux: 'LIEU',
  coordonnees: 'TELEPHONE',
  numeros: 'IDENTIFIANT',
};

export function familyOf(category: Category): FamilyId {
  return FAMILY_OF[category];
}
