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

/** Prénoms féminins de la liste ci-dessus (le reste est masculin, sauf les prénoms mixtes ci-dessous). */
const FEMALE_FIRST_NAMES_RAW = `Agathe Agnès Alice Alicia Amandine Amélie Andrée Anaïs Anne Annie Astrid Audrey Aurélie Barbara Béatrice
Bernadette Brigitte Capucine Carine Carole Caroline Catherine Cécile Céline Charlotte Chloé Christelle Christiane Christine
Claire Clara Claudine Clémence Colette Corinne Danielle Delphine Denise Diane Dorothée Édith Elisa Élise Élodie Emilie Émilie
Emma Emmanuelle Estelle Eugénie Eva Fanny Florence Francine Françoise Gabrielle Gaëlle Geneviève Ginette Gisèle Gladys Hélène
Henriette Inès Irène Isabelle Jacqueline Jeanne Joëlle Josette Josiane Julie Juliette Justine Karine Laetitia Laure Laurence
Léa Léonie Liliane Lina Line Lise Lola Louise Lucie Lydie Magali Manon Marcelle Margaux Marguerite Maria Marianne Marie Marine
Marion Marthe Martine Mathilde Mélanie Mélissa Michèle Micheline Monique Morgane Muriel Mylène Nadège Nadia Nadine Nathalie
Nicole Noémie Océane Odette Odile Olivia Pascale Patricia Paulette Pauline Perrine Pierrette Rachel Raymonde Renée Rose Sabine
Salomé Sandra Sandrine Sarah Simone Solange Sonia Sophie Stéphanie Suzanne Sylvie Thérèse Valérie Vanessa Véronique Victoire
Violette Virginie Yvette Yvonne Zoé`;

/** Prénoms portés par les deux sexes : le genre n'est pas déduit. */
const MIXED_FIRST_NAMES_RAW = 'Alix Camille Claude Dominique Gaël Lou Sacha Yannick';

const FEMALE_FIRST_NAMES: Set<string> = new Set(FEMALE_FIRST_NAMES_RAW.split(/\s+/).filter(Boolean).map(normalizeValue));
const MIXED_FIRST_NAMES: Set<string> = new Set(MIXED_FIRST_NAMES_RAW.split(/\s+/).filter(Boolean).map(normalizeValue));

/** Genre déduit du premier prénom, `null` s'il est inconnu ou mixte (aucune civilité n'est alors écartée). */
export function genderOf(firstName: string): 'F' | 'M' | null {
  const first = normalizeValue(firstName.split(/[-‐-―]/)[0] ?? firstName);
  if (MIXED_FIRST_NAMES.has(first)) return null;
  if (FEMALE_FIRST_NAMES.has(first)) return 'F';
  return FIRST_NAMES.has(first) ? 'M' : null;
}

/** Genre porté par la civilité qui commence `text` (« M. », « Mme »…), `null` sinon ou pour un titre neutre. */
export function civilityGender(text: string): 'M' | 'F' | null {
  const civility = /^(M\.?|Monsieur|Mme|Madame|Mlle)(?=\s)/u.exec(text.trim())?.[1];
  if (!civility) return null;
  return /^(M\.?|Monsieur)$/u.test(civility) ? 'M' : 'F';
}

/** Vrai si la civilité de `text` est compatible avec le prénom de la personne (inconnu ou titre neutre : compatible). */
export function genderCompatible(canonical: string, text: string): boolean {
  const wanted = civilityGender(text);
  if (!wanted) return true;
  const first = parseName(canonical).firstNames[0];
  const gender = first ? genderOf(first) : null;
  return !gender || gender === wanted;
}

/** Civilités et titres reconnus devant un nom. */
export const CIVILITIES = ['Monsieur', 'Madame', 'Mademoiselle', 'Maître', 'Mlle', 'Mme', 'Me', 'Dr', 'Pr', 'M'];

export const CIVILITY_SOURCE = String.raw`(?:Monsieur|Madame|Mademoiselle|Maître|Mlle|Mme|Me|Dr|Pr|M)\.?`;

/** Variantes de civilité ajoutées devant le nom de famille. */
export const CIVILITY_VARIANTS = ['M.', 'Monsieur', 'Mme', 'Madame', 'Mlle', 'Me', 'Maître', 'Dr', 'Pr'];
const MALE_CIVILITIES = new Set(['M.', 'Monsieur']);
const FEMALE_CIVILITIES = new Set(['Mme', 'Madame', 'Mlle']);

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
  // « M. Brunet » est Patrick, « Mme Brunet » est Isabelle : une civilité de l'autre genre n'est pas une variante.
  const gender = genderOf(firstNames[0] as string);
  for (const civ of CIVILITY_VARIANTS) {
    if (gender === 'F' && MALE_CIVILITIES.has(civ)) continue;
    if (gender === 'M' && FEMALE_CIVILITIES.has(civ)) continue;
    out.push(`${civ} ${familyStr}`);
  }
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

/** Variantes d'une organisation : sans forme juridique. Propagation prudente. */
export function organisationVariants(canonical: string): string[] {
  const tokens = canonical.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const last = tokens[tokens.length - 1] ?? '';
  if (tokens.length >= 2 && LEGAL_FORM_SET.has(last)) {
    const short = tokens.slice(0, -1).join(' ');
    if (short.replace(/[^\p{L}]/gu, '').length >= 4 && !isCommonWord(short)) {
      out.push(short);
    }
  }
  return out;
}

export function variantsFor(category: Category, canonical: string): string[] {
  if (category === 'PERSONNE') return personVariants(canonical);
  if (category === 'ORGANISATION') return organisationVariants(canonical);
  return [];
}
