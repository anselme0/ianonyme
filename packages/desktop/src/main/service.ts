// Cœur du processus principal : état des conversations, moteur, fichiers, LLM local, assistant.
// Ne dépend pas d'Electron : testable seul. Le processus principal détient l'état (docs/DOCUMENTATION.md, A.6).

import {
  acceptMention,
  addManualMention,
  chunkText,
  createState,
  createStreamRestorer,
  checkLeak,
  ingestText,
  linkMention,
  mask,
  applyLlmMentions,
  mergeLlmMentions,
  parseLlmOutput,
  protectFileName,
  rejectMention,
  requiresReview,
} from 'engine';
import type { Category, ConversationState, Mention, Segment } from 'engine';
import { CATEGORIES } from 'engine';
import { readFileSync } from 'node:fs';
import type {
  AnalysisView,
  AppInfo,
  ChatChunkEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ConversationSummary,
  ConversationView,
  DecideInput,
  EntityView,
  ErrorCode,
  FileChip,
  FileImportResult,
  MeasureReport,
  MessageView,
  PreviewView,
  ProposeResult,
  SendInput,
} from '../shared/api.js';
import type { AppConfig } from './config.js';
import { DEFAULT_CHUNK_CHARS, DEFAULT_LLM_TIMEOUT_MS, activeLocalModel, configuredProviders } from './config.js';
import { ExtractError, extractFile } from './extract/index.js';
import type { LocalLlm } from './localllm.js';
import { log, logError } from './log.js';
import { SYSTEM_PROMPT } from './prompts.js';
import type { AssistantProvider } from './providers/types.js';
import { composeMessage } from '../shared/compose.js';
import { sanitizeFileName } from './filename.js';
import { LeakBlockedError, preparePayload, secureStream } from './secure-send.js';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  clear: string;
  /** Ce que l'utilisateur a saisi (sans le texte des documents joints) : affiché dans le fil. */
  shown?: string;
  segments?: Segment[];
  anomalyCount?: number;
  files?: { name: string }[];
}

interface DraftFile {
  chip: FileChip;
  text: string;
  /** Nom lisible placé dans le message (séparateurs ouverts). */
  readableName: string;
}

interface Conv {
  id: string;
  title: string;
  titleIsDefault: boolean;
  createdAt: number;
  messages: StoredMessage[];
  state: ConversationState;
  settings: { assistantId: string; deepAnalysisOnMessages: boolean };
  restoredNoticeShown: boolean;
  files: Map<string, DraftFile>;
  abort?: AbortController;
  llmAbort?: AbortController;
}

export interface ServiceEvents {
  chunk(e: ChatChunkEvent): void;
  done(e: ChatDoneEvent): void;
  error(e: ChatErrorEvent): void;
}

export interface ServiceDeps {
  config: AppConfig;
  providers: Map<string, AssistantProvider>;
  llm: LocalLlm;
  events: ServiceEvents;
  measurePath?: string;
}

const DEFAULT_TITLE = 'Nouvelle conversation';

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout();
      reject(new Error('timeout'));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error('error'));
      },
    );
  });
}

function mergeSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.restoredFrom === undefined && s.restoredFrom === undefined) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function isMention(x: unknown): x is Mention {
  if (!x || typeof x !== 'object') return false;
  const m = x as Mention;
  return (
    typeof m.id === 'string' &&
    typeof m.text === 'string' &&
    CATEGORIES.includes(m.category) &&
    typeof m.span?.start === 'number' &&
    typeof m.span?.end === 'number'
  );
}

export class ChatService {
  private convs = new Map<string, Conv>();
  private seq = 0;

  constructor(private readonly deps: ServiceDeps) {}

  // ---- Informations générales ----

  info(): AppInfo {
    const cfg = this.deps.config;
    return {
      providers: configuredProviders(cfg).map((p) => ({
        id: p.id,
        label: p.label,
        simulated: p.type === 'fake',
      })),
      defaultProviderId: this.defaultProviderId(),
      localAnalysis: this.deps.llm.status(),
      localAnalysisSimulated: this.deps.llm.simulated,
      user: cfg.user,
      maxFileBytes: cfg.limits.maxFileBytes,
    };
  }

  private defaultProviderId(): string {
    const ids = configuredProviders(this.deps.config).map((p) => p.id);
    return ids.includes(this.deps.config.assistant.default) ? this.deps.config.assistant.default : (ids[0] ?? '');
  }

  measure(): MeasureReport | null {
    if (!this.deps.measurePath) return null;
    try {
      return JSON.parse(readFileSync(this.deps.measurePath, 'utf8')) as MeasureReport;
    } catch {
      return null;
    }
  }

  llmStatus(): { status: ReturnType<LocalLlm['status']>; simulated: boolean } {
    return { status: this.deps.llm.status(), simulated: this.deps.llm.simulated };
  }

  // ---- Conversations ----

  private get(convId: string): Conv {
    const conv = this.convs.get(convId);
    if (!conv) throw new Error('conversation_not_found');
    return conv;
  }

  private summary(c: Conv): ConversationSummary {
    return {
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      protectedCount: Object.keys(c.state.entities).length,
    };
  }

  list(): ConversationSummary[] {
    return [...this.convs.values()].sort((a, b) => b.createdAt - a.createdAt).map((c) => this.summary(c));
  }

  private messageView(m: StoredMessage): MessageView {
    const view: MessageView = { id: m.id, role: m.role, text: m.shown ?? m.clear };
    if (m.segments) view.segments = m.segments;
    if (m.anomalyCount) view.anomalyCount = m.anomalyCount;
    if (m.files) view.files = m.files;
    return view;
  }

  private view(c: Conv): ConversationView {
    const entities: EntityView[] = Object.values(c.state.entities).map((e) => ({
      id: e.id,
      category: e.category,
      canonical: e.canonical,
      placeholder: e.placeholder,
    }));
    return {
      ...this.summary(c),
      messages: c.messages.map((m) => this.messageView(m)),
      entities,
      settings: c.settings,
      restoredNoticeShown: c.restoredNoticeShown,
    };
  }

  create(): ConversationView {
    const id = `c${++this.seq}_${Date.now().toString(36)}`;
    const conv: Conv = {
      id,
      title: DEFAULT_TITLE,
      titleIsDefault: true,
      createdAt: Date.now() + this.seq,
      messages: [],
      state: createState(),
      settings: { assistantId: this.defaultProviderId(), deepAnalysisOnMessages: true },
      restoredNoticeShown: false,
      files: new Map(),
    };
    this.convs.set(id, conv);
    log('service', 'conversation_created', { count: this.convs.size });
    return this.view(conv);
  }

  getView(convId: string): ConversationView {
    return this.view(this.get(convId));
  }

  rename(convId: string, title: string): ConversationSummary[] {
    const c = this.get(convId);
    const t = title.trim().slice(0, 120);
    if (t.length > 0) {
      c.title = t;
      c.titleIsDefault = false;
    }
    return this.list();
  }

  remove(convId: string): ConversationSummary[] {
    this.convs.get(convId)?.abort?.abort();
    this.convs.delete(convId);
    return this.list();
  }

  /** Efface les messages et les correspondances de la conversation. */
  clear(convId: string): ConversationView {
    const c = this.get(convId);
    c.abort?.abort();
    c.messages = [];
    c.state = createState();
    c.files.clear();
    c.restoredNoticeShown = false;
    c.title = DEFAULT_TITLE;
    c.titleIsDefault = true;
    return this.view(c);
  }

  updateSettings(input: { convId: string; assistantId?: string; deepAnalysisOnMessages?: boolean }): ConversationView {
    const c = this.get(input.convId);
    if (input.assistantId !== undefined && this.deps.providers.has(input.assistantId)) {
      c.settings = { ...c.settings, assistantId: input.assistantId };
    }
    if (typeof input.deepAnalysisOnMessages === 'boolean') {
      c.settings = { ...c.settings, deepAnalysisOnMessages: input.deepAnalysisOnMessages };
    }
    return this.view(c);
  }

  // ---- Fichiers ----

  async importFile(convId: string, name: string, bytes: Uint8Array): Promise<FileImportResult> {
    const c = this.get(convId);
    try {
      const extracted = await extractFile(name, bytes, this.deps.config.limits.maxFileBytes);
      const { maskedName } = protectFileName(c.state, name);
      // Le nom envoyé est le nom masqué, dont tout mot inconnu est remplacé (voir filename.ts).
      const sendable = sanitizeFileName(maskedName);
      const chip: FileChip = {
        id: `f${++this.seq}`,
        name,
        readableName: sendable,
        maskedName: sendable,
        warnings: extracted.warnings,
        characters: extracted.text.length,
      };
      c.files.set(chip.id, { chip, text: extracted.text, readableName: sendable });
      log('service', 'file_imported', { chars: extracted.text.length, warnings: extracted.warnings.length });
      return { ok: true, file: chip, text: extracted.text };
    } catch (e) {
      const reason: ErrorCode = e instanceof ExtractError ? e.code : 'file_unreadable';
      log('service', 'file_blocked', { code_len: reason.length });
      return { ok: false, blocked: { reason } };
    }
  }

  discardFile(convId: string, fileId: string): void {
    this.get(convId).files.delete(fileId);
  }

  // ---- Détection ----

  /**
   * Détection. Par défaut elle n'enregistre rien : une frappe ne crée pas d'entité durable.
   * `commit` l'enregistre, pour la revue (les décisions de l'utilisateur portent sur ces entités).
   */
  analyze(convId: string, text: string, commit = false): AnalysisView {
    const c = this.get(convId);
    const { state, mentions, conflicts } = ingestText(c.state, text);
    if (commit) c.state = state;
    const { masked, replacements } = mask(text, state);
    return {
      mentions,
      conflicts,
      maskedText: masked,
      protectedInText: new Set(replacements.map((r) => r.entityId)).size,
      leak: checkLeak(masked, state),
    };
  }

  /** Analyse approfondie par le LLM local. Tout échec bascule en analyse de base. */
  async propose(convId: string, text: string): Promise<ProposeResult> {
    const c = this.get(convId);
    const empty = {
      mentions: [] as Mention[],
      conflicts: [],
      stats: { proposed: 0, retained: 0, invalidJson: 0, hallucinated: 0, invalidCategory: 0, duplicates: 0, capped: 0, durationMs: 0 },
    };
    const llm = this.deps.llm;
    if (llm.status() !== 'ready') {
      return { ...empty, degraded: true, degradedReason: 'absent' };
    }
    const started = Date.now();
    const entry = activeLocalModel(this.deps.config);
    const chunkChars = entry?.chunkChars && entry.chunkChars > 0 ? entry.chunkChars : DEFAULT_CHUNK_CHARS;
    const timeoutMs = entry?.timeoutMs && entry.timeoutMs > 0 ? entry.timeoutMs : DEFAULT_LLM_TIMEOUT_MS;
    // Les entités repérées par les règles sont enregistrées : les suggestions s'y rattachent.
    const { state } = ingestText(c.state, text);
    c.state = state;
    const controller = new AbortController();
    c.llmAbort = controller;
    const raw: unknown[] = [];
    let invalidJson = 0;
    try {
      const chunks = chunkText(text, chunkChars);
      for (const chunk of chunks) {
        if (controller.signal.aborted) return { ...empty, degraded: true, degradedReason: 'absent' };
        let parsed: unknown[] | null = null;
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const out = await withTimeout(llm.propose(chunk, state, controller.signal), timeoutMs, () => controller.abort());
          parsed = parseLlmOutput(out);
        }
        if (parsed) raw.push(...parsed);
        else invalidJson++;
      }
      const maxMentions = this.deps.config.limits.maxMentionsPerChunk * Math.max(1, chunks.length);
      const merged = mergeLlmMentions(raw, text, state, { maxMentions, invalidJson });
      // L'analyse décide : tout est protégé d'office, sauf les cas ambigus laissés à l'utilisateur.
      const applied = applyLlmMentions(state, merged.mentions, merged.conflicts, merged.peerLinks);
      c.state = applied.state;
      merged.mentions = applied.remaining;
      merged.stats.durationMs = Date.now() - started;
      log('service', 'llm_done', { proposed: merged.stats.proposed, retained: merged.stats.retained, ms: merged.stats.durationMs });
      return { mentions: merged.mentions, conflicts: merged.conflicts, stats: merged.stats, degraded: false };
    } catch (e) {
      logError('service', 'llm_failed', e);
      const timedOut = e instanceof Error && e.message === 'timeout';
      return { ...empty, degraded: true, degradedReason: timedOut ? 'timeout' : controller.signal.aborted ? 'absent' : 'error' };
    } finally {
      c.llmAbort = undefined;
    }
  }

  skipAnalysis(convId: string): void {
    this.convs.get(convId)?.llmAbort?.abort();
  }

  // ---- Décisions ----

  decide(input: DecideInput): ConversationView {
    const c = this.get(input.convId);
    switch (input.action) {
      case 'accept':
        if (!isMention(input.mention)) throw new Error('internal');
        c.state = acceptMention(c.state, input.mention, input.entityId);
        break;
      case 'reject':
        if (!isMention(input.mention)) throw new Error('internal');
        c.state = rejectMention(c.state, input.mention);
        break;
      case 'link':
        if (!isMention(input.mention) || !input.entityId) throw new Error('internal');
        c.state = linkMention(c.state, input.mention, input.entityId);
        break;
      case 'add': {
        const category = input.category as Category | undefined;
        if (typeof input.text !== 'string' || !category || !CATEGORIES.includes(category)) throw new Error('internal');
        c.state = addManualMention(c.state, input.text, category, input.entityId);
        break;
      }
      default:
        throw new Error('internal');
    }
    return this.view(c);
  }

  // ---- Envoi ----

  private compose(c: Conv, userText: string, fileIds: string[]): { text: string; files: DraftFile[] } {
    const files = fileIds.map((id) => c.files.get(id)).filter((f): f is DraftFile => f !== undefined);
    return { text: composeMessage(userText, files), files };
  }

  /** Ce que l'assistant recevrait, historique compris, sans rien envoyer ni enregistrer. */
  preview(convId: string, userText: string, fileIds: string[], pendingSuggestions: number): PreviewView {
    const c = this.get(convId);
    const { text, files } = this.compose(c, userText, fileIds);
    let state = c.state;
    for (const f of files) state = protectFileName(state, f.chip.name).state;
    const ingested = ingestText(state, text);
    const conv = {
      id: c.id,
      title: c.title,
      state: ingested.state,
      settings: c.settings,
      messages: [...c.messages.map((m) => ({ role: m.role, clear: m.clear })), { role: 'user' as const, clear: text }],
    };
    const payload = preparePayload(conv);
    const maskedCurrent = payload.messages[payload.messages.length - 1]?.content ?? '';
    return {
      maskedPayload: payload.messages,
      maskedCurrent,
      leak: { ok: payload.leaks.length === 0, leaks: payload.leaks },
      requiresReview: requiresReview({
        isFile: files.length > 0,
        pendingLlmSuggestions: pendingSuggestions,
        conflicts: ingested.conflicts.length,
      }),
      mentions: ingested.mentions,
      conflicts: ingested.conflicts,
      pendingSuggestions,
      protectedInMessage: new Set(maskedCurrent.match(/\[[A-Z][A-Z_]*_\d+\]/g) ?? []).size,
    };
  }

  /** Lance l'envoi. Le résultat arrive par évènements (chunk, done, error). */
  send(input: SendInput): { requestId: string } {
    const requestId = `r${++this.seq}`;
    void this.run(input, requestId).catch((e: unknown) => {
      logError('service', 'send_failed', e);
      this.deps.events.error({ convId: input.convId, requestId, code: 'internal' });
    });
    return { requestId };
  }

  stop(convId: string): void {
    this.convs.get(convId)?.abort?.abort();
  }

  private async run(input: SendInput, requestId: string): Promise<void> {
    const { events } = this.deps;
    const c = this.convs.get(input.convId);
    if (!c) return events.error({ convId: input.convId, requestId, code: 'conversation_not_found' });
    if (c.abort) return events.error({ convId: c.id, requestId, code: 'internal' });
    const provider = this.deps.providers.get(c.settings.assistantId);
    if (!provider) return events.error({ convId: c.id, requestId, code: 'assistant_not_configured' });

    // Messages candidats : la conversation ne change qu'après la vérification de sécurité.
    let state = c.state;
    let messages = c.messages;
    let pendingUser: StoredMessage | null = null;
    let usedFiles: DraftFile[] = [];
    if (input.regenerate) {
      if (messages[messages.length - 1]?.role === 'assistant') messages = messages.slice(0, -1);
      if (messages[messages.length - 1]?.role !== 'user') {
        return events.error({ convId: c.id, requestId, code: 'internal' });
      }
    } else {
      const { text, files } = this.compose(c, input.userText, input.fileIds);
      if (text.length === 0) return;
      usedFiles = files;
      for (const f of files) state = protectFileName(state, f.chip.name).state;
      state = ingestText(state, text).state;
      pendingUser = {
        id: `m${++this.seq}`,
        role: 'user',
        clear: text,
        shown: input.userText.trim(),
        files: files.map((f) => ({ name: f.chip.name })),
      };
      messages = [...messages, pendingUser];
    }

    const conv = {
      id: c.id,
      title: c.title,
      state,
      settings: c.settings,
      messages: messages.map((m) => ({ role: m.role, clear: m.clear })),
    };
    const controller = new AbortController();
    let stream: AsyncIterable<string>;
    try {
      stream = secureStream(provider, conv, controller.signal, { system: SYSTEM_PROMPT });
    } catch (e) {
      if (e instanceof LeakBlockedError) {
        log('service', 'send_blocked', { leaks: e.leaks.length });
        return events.error({ convId: c.id, requestId, code: 'leak_blocked', leaks: e.leaks });
      }
      throw e;
    }

    // La vérification est passée : on enregistre le message et les nouvelles correspondances.
    c.state = state;
    c.messages = messages;
    if (pendingUser) {
      for (const f of usedFiles) c.files.delete(f.chip.id);
      if (c.titleIsDefault) {
        const base = input.userText.trim() || usedFiles[0]?.chip.name || DEFAULT_TITLE;
        c.title = base.replace(/\s+/g, ' ').slice(0, 48);
        c.titleIsDefault = false;
      }
    }
    c.abort = controller;
    const restorer = createStreamRestorer(c.state);
    const segments: Segment[] = [];
    const started = Date.now();
    try {
      for await (const chunk of stream) {
        const segs = restorer.push(chunk);
        if (segs.length > 0) {
          segments.push(...segs);
          events.chunk({ convId: c.id, requestId, segments: segs });
        }
        if (controller.signal.aborted) break;
      }
      const tail = restorer.flush();
      if (tail.length > 0) {
        segments.push(...tail);
        events.chunk({ convId: c.id, requestId, segments: tail });
      }
    } catch (e) {
      c.abort = undefined;
      logError('service', 'stream_failed', e);
      return events.error({ convId: c.id, requestId, code: 'assistant_unreachable' });
    }
    c.abort = undefined;
    const merged = mergeSegments(segments);
    const restored = merged.map((s) => s.text).join('');
    const stopped = controller.signal.aborted;
    if (restored.length === 0 && stopped) {
      return events.done({
        convId: c.id,
        requestId,
        message: { id: `m${++this.seq}`, role: 'assistant', text: '' },
        anomalies: [],
        view: this.view(c),
      });
    }
    const stored: StoredMessage = {
      id: `m${++this.seq}`,
      role: 'assistant',
      clear: restored,
      segments: merged,
      anomalyCount: restorer.anomalies.length,
    };
    c.messages = [...c.messages, stored];
    if (merged.some((s) => s.restoredFrom !== undefined)) c.restoredNoticeShown = true;
    log('service', 'reply_done', { chars: restored.length, ms: Date.now() - started, anomalies: restorer.anomalies.length, stopped });
    events.done({
      convId: c.id,
      requestId,
      message: this.messageView(stored),
      anomalies: restorer.anomalies,
      view: this.view(c),
    });
  }
}
