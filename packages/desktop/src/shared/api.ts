// Contrat entre le processus principal et l'interface (docs/DOCUMENTATION.md, annexe A.6).
// Les erreurs traversent la frontière sous forme de codes : jamais de texte du document.

import type {
  Anomaly,
  Category,
  Conflict,
  LeakItem,
  LlmStats,
  Mention,
  Segment,
} from 'engine';

export type ErrorCode =
  | 'leak_blocked'
  | 'assistant_unreachable'
  | 'assistant_not_configured'
  | 'file_scanned_pdf'
  | 'file_image'
  | 'file_encoding'
  | 'file_too_large'
  | 'file_unsupported'
  | 'file_unreadable'
  | 'conversation_not_found'
  | 'internal';

export type WarningCode =
  | 'docx_comments'
  | 'docx_revisions'
  | 'docx_images'
  | 'pdf_pages_without_text'
  | 'pdf_images';

export interface FileWarning {
  code: WarningCode;
  /** Numéros de page, pour `pdf_pages_without_text`. */
  pages?: number[];
}

export type LocalAnalysisStatus = 'ready' | 'loading' | 'absent' | 'error';

export interface ProviderInfo {
  id: string;
  label: string;
  /** Vrai pour le faux assistant hors ligne : l'interface le dit clairement. */
  simulated: boolean;
}

export interface AppInfo {
  providers: ProviderInfo[];
  defaultProviderId: string;
  localAnalysis: LocalAnalysisStatus;
  /** Vrai si le « modèle local » est un faux scripté pour les tests. */
  localAnalysisSimulated: boolean;
  user: { name: string; firm: string; email: string };
  maxFileBytes: number;
}

export interface EntityView {
  id: string;
  category: Category;
  canonical: string;
  placeholder: string;
  /** Autres formes sous lesquelles l'élément apparaît (variantes, fonction ou lien rattachés). */
  variants: string[];
}

export interface FileChip {
  id: string;
  /** Nom d'origine, affiché à l'utilisateur seulement. */
  name: string;
  /** Nom ouvert (séparateurs en espaces), tel qu'il figure dans le message. */
  readableName: string;
  maskedName: string;
  warnings: FileWarning[];
  characters: number;
}

export interface MessageView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Réponse restituée, avec l'origine de chaque valeur. */
  segments?: Segment[];
  anomalyCount?: number;
  files?: { name: string }[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  protectedCount: number;
}

export interface ConversationView extends ConversationSummary {
  messages: MessageView[];
  entities: EntityView[];
  settings: { assistantId: string; deepAnalysisOnMessages: boolean };
  /** Le message d'information sur les noms soulignés a déjà été montré. */
  restoredNoticeShown: boolean;
}

export interface AnalysisView {
  mentions: Mention[];
  conflicts: Conflict[];
  maskedText: string;
  /** Ce qui est remplacé dans le texte envoyé, à sa place dans le texte d'origine. */
  replacements: { start: number; end: number; placeholder: string }[];
  protectedInText: number;
  leak: { ok: boolean; leaks: LeakItem[] };
}

export interface PreviewView {
  /** Texte exact que l'assistant recevrait, historique compris. */
  maskedPayload: { role: string; content: string }[];
  maskedCurrent: string;
  leak: { ok: boolean; leaks: LeakItem[] };
  requiresReview: boolean;
  mentions: Mention[];
  conflicts: Conflict[];
  pendingSuggestions: number;
  protectedInMessage: number;
}

export interface ProposeResult {
  mentions: Mention[];
  conflicts: Conflict[];
  stats: LlmStats;
  /** Vrai si l'analyse approfondie a été abandonnée (absente, lente, en erreur). */
  degraded: boolean;
  degradedReason?: 'absent' | 'timeout' | 'error';
}

export type DecideAction = 'accept' | 'reject' | 'link' | 'add';

export interface DecideInput {
  convId: string;
  action: DecideAction;
  mention?: Mention;
  entityId?: string;
  text?: string;
  category?: Category;
}

export interface FileImportResult {
  ok: boolean;
  file?: FileChip;
  text?: string;
  blocked?: { reason: ErrorCode };
}

export interface MeasureReport {
  mode: string;
  note: string;
  corpusDocuments: number;
  sets: Record<string, MeasureAggregate>;
  all: MeasureAggregate;
}

export interface MeasureCounter {
  total: number;
  detected: number;
  bySource: { regex: number; variant: number; llm: number };
}

export interface MeasureAggregate {
  documents: number;
  table: Record<string, { direct: MeasureCounter; indirect: MeasureCounter }>;
  total: { direct: MeasureCounter; indirect: MeasureCounter };
  directValues: number;
  directValuesLeft: number;
  falseAutomaticPerDocument: number;
  falseSuggestionsPerDocument: number;
  conflictsPerDocument: number;
}

export interface ChatChunkEvent {
  convId: string;
  requestId: string;
  segments: Segment[];
}
export interface ChatDoneEvent {
  convId: string;
  requestId: string;
  message: MessageView;
  anomalies: Anomaly[];
  view: ConversationView;
}
export interface ChatErrorEvent {
  convId: string;
  requestId: string;
  code: ErrorCode;
  /** Valeurs restées visibles, pour le message d'envoi bloqué (affichage seulement). */
  leaks?: LeakItem[];
  /** Texte partiel déjà reçu, conservé à l'affichage. */
  partial?: boolean;
}

export interface SendInput {
  convId: string;
  userText: string;
  fileIds: string[];
  regenerate?: boolean;
}

/** Surface exposée à l'interface par le script de préchargement. */
export interface IanonymeApi {
  app: { info(): Promise<AppInfo>; measure(): Promise<MeasureReport | null> };
  conversations: {
    list(): Promise<ConversationSummary[]>;
    create(): Promise<ConversationView>;
    get(convId: string): Promise<ConversationView>;
    rename(convId: string, title: string): Promise<ConversationSummary[]>;
    remove(convId: string): Promise<ConversationSummary[]>;
    clear(convId: string): Promise<ConversationView>;
  };
  settings: {
    update(input: {
      convId: string;
      assistantId?: string;
      deepAnalysisOnMessages?: boolean;
    }): Promise<ConversationView>;
  };
  files: {
    import(convId: string, name: string, bytes: ArrayBuffer): Promise<FileImportResult>;
    discard(convId: string, fileId: string): Promise<void>;
  };
  detect: { run(convId: string, text: string, commit?: boolean): Promise<AnalysisView> };
  llm: {
    status(): Promise<{ status: LocalAnalysisStatus; simulated: boolean }>;
    propose(convId: string, text: string): Promise<ProposeResult>;
    skip(convId: string): Promise<void>;
  };
  mentions: { decide(input: DecideInput): Promise<ConversationView> };
  chat: {
    preview(
      convId: string,
      userText: string,
      fileIds: string[],
      pendingSuggestions: number,
    ): Promise<PreviewView>;
    send(input: SendInput): Promise<{ requestId: string }>;
    stop(convId: string): Promise<void>;
  };
  on: {
    chunk(cb: (e: ChatChunkEvent) => void): () => void;
    done(cb: (e: ChatDoneEvent) => void): () => void;
    error(cb: (e: ChatErrorEvent) => void): () => void;
  };
}

export const CHANNELS = {
  appInfo: 'app:info',
  appMeasure: 'app:measure',
  convList: 'conversation:list',
  convCreate: 'conversation:create',
  convGet: 'conversation:get',
  convRename: 'conversation:rename',
  convRemove: 'conversation:remove',
  convClear: 'conversation:clear',
  settingsUpdate: 'settings:update',
  filesImport: 'files:import',
  filesDiscard: 'files:discard',
  detectRun: 'detect:run',
  llmStatus: 'llm:status',
  llmPropose: 'llm:propose',
  llmSkip: 'llm:skip',
  mentionsDecide: 'mentions:decide',
  chatPreview: 'chat:preview',
  chatSend: 'chat:send',
  chatStop: 'chat:stop',
  chatChunk: 'chat:chunk',
  chatDone: 'chat:done',
  chatError: 'chat:error',
} as const;
