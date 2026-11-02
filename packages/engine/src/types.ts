// Types du contrat de données (docs/DOCUMENTATION.md, annexe A.1).

export type Category =
  | 'PERSONNE'
  | 'ORGANISATION'
  | 'LIEU'
  | 'ADRESSE'
  | 'EMAIL'
  | 'TELEPHONE'
  | 'IBAN'
  | 'DATE_NAISSANCE'
  | 'NUM_DOSSIER'
  | 'IDENTIFIANT'
  | 'FONCTION'
  | 'LIEN_PARENTE';

export const CATEGORIES: readonly Category[] = [
  'PERSONNE',
  'ORGANISATION',
  'LIEU',
  'ADRESSE',
  'EMAIL',
  'TELEPHONE',
  'IBAN',
  'DATE_NAISSANCE',
  'NUM_DOSSIER',
  'IDENTIFIANT',
  'FONCTION',
  'LIEN_PARENTE',
];

export type Source = 'regex' | 'variant' | 'llm' | 'manual';

/** Offsets dans le texte source (unités UTF-16, fin exclue). */
export interface Span {
  start: number;
  end: number;
}

export interface Mention {
  id: string;
  /** Valeur telle qu'elle apparaît dans le texte. */
  text: string;
  span: Span;
  category: Category;
  source: Source;
  /** Entité rattachée, si connue. */
  entityId?: string;
  status: 'suggested' | 'accepted' | 'rejected';
}

export interface Entity {
  id: string;
  category: Category;
  /** Forme de référence, restituée dans les réponses. */
  canonical: string;
  /** Autres formes à masquer. */
  variants: string[];
  placeholder: string;
}

export interface Conflict {
  mentionId: string;
  /** Plusieurs entités possibles : jamais fusionnées automatiquement. */
  candidateEntityIds: string[];
  reason: string;
}

export interface ConversationState {
  entities: Record<string, Entity>;
  /** Dernier numéro attribué par catégorie. Jamais décrémenté. */
  counters: Partial<Record<Category, number>>;
  /** Valeurs rejetées (forme normalisée) : plus jamais suggérées dans cette conversation. */
  rejectedValues: string[];
  /** Dernier numéro d'entité attribué (ajout au contrat : identifiants jamais réutilisés). */
  entityCounter: number;
  /** Valeur normalisée partagée par plusieurs entités -> entité choisie par l'utilisateur. */
  preferred: Record<string, string>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  /** Seule version stockée ; la version masquée est toujours recalculée. */
  clear: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  state: ConversationState;
  settings: { assistantId: string; deepAnalysisOnMessages: boolean };
}

export interface Replacement {
  span: Span;
  placeholder: string;
  entityId: string;
  /** Texte d'origine remplacé (ne jamais journaliser). */
  original: string;
}

export interface Segment {
  text: string;
  /** Identifiant de l'entité dont la valeur a été restituée. */
  restoredFrom?: string;
}

export interface Anomaly {
  kind: 'unknown_placeholder' | 'malformed_placeholder';
  text: string;
  position: number;
}

export interface LeakItem {
  /** Valeur trouvée (ne jamais journaliser). */
  value: string;
  entityId?: string;
  kind: 'exact' | 'regex';
  /** Index du message de l'historique concerné, si connu. */
  messageIndex?: number;
}

export interface LeakReport {
  ok: boolean;
  leaks: LeakItem[];
}

export type LlmCategory =
  | 'PERSONNE'
  | 'ORGANISATION'
  | 'LIEU'
  | 'ADRESSE'
  | 'FONCTION'
  | 'LIEN_PARENTE'
  | 'IDENTIFIANT';

export interface LlmMention {
  text: string;
  category: LlmCategory;
  linkedTo: string | null;
}

export interface LlmStats {
  proposed: number;
  retained: number;
  invalidJson: number;
  hallucinated: number;
  invalidCategory: number;
  duplicates: number;
  capped: number;
  durationMs: number;
}
