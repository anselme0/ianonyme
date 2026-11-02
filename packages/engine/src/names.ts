// Noms de personnes et d'organisations : analyse et propagation des variantes
// (docs/DOCUMENTATION.md, annexe B.2).

import { normalizeValue } from './normalize.js';
import type { Category } from './types.js';

/**
 * Prénoms courants, liste écrite à la main pour le prototype (aucune source externe).
 * Les formes sont comparées sans accent ni casse.
 */
const FIRST_NAMES_RAW = `Adrien Agathe Agnès Aimé Alain Alexandre Alexandra Alexis Alice Alicia Alix Amandine Amélie André Andrée Anaïs
Anne Annie Antoine Antonin Arnaud Arthur Astrid Audrey Aurélie Aurélien Axel Baptiste Barbara Basile Béatrice Benjamin Benoît
Bernadette Bernard Bertrand Brigitte Bruno Camille Capucine Carine Carole Caroline Catherine Cécile Cédric Céline Charles
Charlotte Chloé Christelle Christian Christiane Christine Christophe Claire Clara Claude Claudine Clémence Clément Colette
Corinne Cyril Damien Daniel Danielle David Delphine Denis Denise Diane Dominique Dorothée Édith Edgar Édouard Elisa Élise
Élodie Émile Emilie Émilie Emma Emmanuel Emmanuelle Éric Erwan Estelle Étienne Eugénie Eva Fabien Fabrice Fanny Fernand
Florence Florent Florian Francine Franck François Françoise Frédéric Gabriel Gabrielle Gaël Gaëlle Gaspard Gautier Geneviève
Georges Gérald Gérard Germain Gilbert Gilles Ginette Gisèle Gladys Gregory Grégoire Grégory Guillaume Guy Gustave Hélène
Henri Henriette Hervé Hubert Hugo Hugues Ibrahim Inès Irène Isabelle Jacqueline Jacques Jean Jeanne Jérémie Jérôme Joëlle
Joël Joseph Josette Josiane José Jules Julie Julien Juliette Justine Karim Karine Kévin Laetitia Laure Laurence Laurent
Léa Léo Léon Léonard Léonie Liliane Lilian Lina Line Lionel Lise Loïc Lola Louis Louise Lucas Lucie Lucien Ludovic Lydie
Magali Manon Marc Marcel Marcelle Marceau Margaux Marguerite Maria Marianne Marie Marine Marion Marius Marthe Martine Mathias
Mathieu Mathilde Matthieu Maurice Maxime Mélanie Mélissa Michel Michèle Micheline Mohamed Mohammed Monique Morgane Muriel
Mylène Nadège Nadia Nadine Nathalie Nathan Nicolas Nicole Noémie Noël Norbert Océane Odette Odile Olivia Olivier Oscar
Pascal Pascale Patricia Patrick Paul Paulette Pauline Perrine Philippe Pierre Pierrette Quentin Rachel Raphaël Raymond
Raymonde Rémi Rémy Renaud Renée René Richard Robert Roger Roland Romain Ronan Rose Sabine Salomé Samuel Sandra Sandrine
Sarah Serge Sébastien Simon Simone Solange Sonia Sophie Stéphane Stéphanie Suzanne Sylvain Sylvie Tanguy Théo Théodore
Thérèse Thibault Thierry Thomas Timothée Tristan Valentin Valérie Vanessa Véronique Victor Victoire Vincent Violette
Virginie Xavier Yann Yannick Yves Yvette Yvonne Zoé`;

export const FIRST_NAMES: Set<string> = new Set(
  FIRST_NAMES_RAW.split(/\s+/).filter(Boolean).map(normalizeValue),
);

export function isFirstName(token: string): boolean {
  const first = token.split(/[-‐-―]/)[0] ?? token;
  return FIRST_NAMES.has(normalizeValue(first));
}

/** Civilités et titres reconnus devant un nom. */
export const CIVILITIES = ['Monsieur', 'Madame', 'Mademoiselle', 'Maître', 'Mlle', 'Mme', 'Me', 'Dr', 'Pr', 'M'];

export const CIVILITY_SOURCE = String.raw`(?:Monsieur|Madame|Mademoiselle|Maître|Mlle|Mme|Me|Dr|Pr|M)\.?`;

/** Variantes de civilité ajoutées devant le nom de famille. */
const CIVILITY_VARIANTS = ['M.', 'Monsieur', 'Mme', 'Madame', 'Mlle', 'Me', 'Maître', 'Dr', 'Pr'];

/** Mots capitalisés qui ne font jamais partie d'un nom (début de phrase, articles…). */
export const NAME_STOPWORDS = new Set(
  `le la les un une des du de au aux il elle ils elles son sa ses leur leurs ce cette ces dans pour par sur sous avec
  chez et ou mais donc or ni car selon lors après avant depuis pendant vers entre sans comme si quand que qui dont où
  fait suite voir note objet dossier rapport article monsieur madame mademoiselle maître le`.split(/\s+/),
);

const PARTICLES = new Set(['de', 'du', 'des', 'd', 'le', 'la', 'van', 'von', 'der', 'den', 'ter', 'el', 'al']);

/** Noms de famille qui sont aussi des mots courants : jamais propagés seuls. */
const COMMON_WORD_SURNAMES = new Set(
  `petit petite grand grande blanc blanche noir noire roux fort forte brun brune jeune vieux long court
  maire expert avocat juge tribunal cour société cabinet avenue rue place monsieur madame`.split(/\s+/),
);

export interface ParsedName {
  firstNames: string[];
  /** Nom de famille, particules comprises. */
  family: string[];
}

export function stripCivility(value: string): string {
  return value.replace(new RegExp(`^${CIVILITY_SOURCE}\\s+`, 'u'), '').trim();
}

export function parseName(canonical: string): ParsedName {
  const tokens = canonical.split(/[\s ]+/).filter(Boolean);
  if (tokens.length < 2) return { firstNames: [], family: tokens };
  // Le nom de famille commence au premier jeton qui n'est pas un prénom, particules incluses.
  let split = tokens.length - 1;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!isFirstName(tokens[i] as string)) {
      split = i;
      break;
    }
  }
  if (split === 0) {
    // Premier jeton inconnu : forme inversée (« Garnier Jean ») si le dernier est un prénom connu,
    // sinon prénom inconnu suivi du nom de famille (« Dimitri Kowal »).
    const last = tokens[tokens.length - 1] as string;
    if (isFirstName(last)) return { firstNames: [last], family: tokens.slice(0, -1) };
    split = tokens.length - 1;
  }
  // Remonte devant les particules (ex. « Marie de La Fontaine »).
  while (split > 1 && PARTICLES.has(normalizeValue(tokens[split - 1] as string))) split--;
  return { firstNames: tokens.slice(0, split), family: tokens.slice(split) };
}

export function isCommonWord(value: string): boolean {
  return COMMON_WORD_SURNAMES.has(normalizeValue(value));
}

/** Variantes d'une personne (B.2). Le prénom seul n'est jamais généré. */
export function personVariants(canonical: string): string[] {
  const { firstNames, family } = parseName(canonical);
  const familyStr = family.join(' ');
  const out: string[] = [];
  // Un nom de famille court ou courant n'est pas propagé seul.
  const familyOk = familyStr.replace(/[^\p{L}]/gu, '').length >= 3 && !isCommonWord(familyStr);
  if (!familyOk || firstNames.length === 0) return out;
  out.push(familyStr);
  for (const civ of CIVILITY_VARIANTS) out.push(`${civ} ${familyStr}`);
  const initials = firstNames.map((f) => `${f[0]?.toUpperCase() ?? ''}.`);
  out.push(`${firstNames.join(' ')} ${familyStr}`);
  out.push(`${initials[0]} ${familyStr}`);
  if (initials.length > 1) out.push(`${initials.join(' ')} ${familyStr}`);
  out.push(`${familyStr} ${firstNames.join(' ')}`);
  out.push(`${familyStr}, ${firstNames.join(' ')}`);
  return out;
}

const LEGAL_FORMS = ['SARL', 'SAS', 'SASU', 'SA', 'SCI', 'EURL', 'SNC', 'SELARL', 'SCP', 'SCOP', 'GIE'];
export const LEGAL_FORM_SET = new Set(LEGAL_FORMS);
export const LEGAL_FORM_SOURCE = `(?:${LEGAL_FORMS.join('|')})`;

export const ORG_KEYWORDS_STRIPPED = ['société', 'societe', 'sté', 'entreprise'];

/** Variantes d'une organisation : sans forme juridique, avec « Société ». Propagation prudente. */
export function organisationVariants(canonical: string): string[] {
  const tokens = canonical.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const last = tokens[tokens.length - 1] ?? '';
  if (tokens.length >= 2 && LEGAL_FORM_SET.has(last)) {
    const short = tokens.slice(0, -1).join(' ');
    if (short.replace(/[^\p{L}]/gu, '').length >= 4 && !isCommonWord(short)) {
      out.push(short);
      out.push(`Société ${short}`);
    }
  }
  return out;
}

export function variantsFor(category: Category, canonical: string): string[] {
  if (category === 'PERSONNE') return personVariants(canonical);
  if (category === 'ORGANISATION') return organisationVariants(canonical);
  return [];
}
