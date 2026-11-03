import { TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, LeakItem, Mention, Segment } from 'engine';
import type {
  AnalysisView,
  AppInfo,
  ChatDoneEvent,
  ChatErrorEvent,
  ConversationSummary,
  ConversationView,
  DecideInput,
  ErrorCode,
  MeasureReport,
  PreviewView,
} from '../shared/api.js';
import { composeMessage } from '../shared/compose.js';
import { api } from './api.js';
import { About } from './components/About.js';
import { Composer } from './components/Composer.js';
import type { ComposerFile } from './components/Composer.js';
import { InlineReview } from './components/InlineReview.js';
import { PreviewDialog, ProtectedText } from './components/PreviewDialog.js';
import { ProtectionPanel } from './components/ProtectionPanel.js';
import { Reliability } from './components/Reliability.js';
import { Review } from './components/Review.js';
import { Settings } from './components/Settings.js';
import type { ThemeChoice } from './components/Settings.js';
import { Sidebar } from './components/Sidebar.js';
import { Startup } from './components/Startup.js';
import { Thread } from './components/Thread.js';
import { marksFrom } from './marks.js';
import { t } from './messages.js';

type UiFile = ComposerFile & {
  uid: string;
  reviewed: boolean;
  text: string;
  /** Cas ambigus laissés par l'analyse approfondie, à traiter à la vérification. */
  suggestions: Mention[];
  degraded: ReviewState['degraded'];
};

interface ReviewState {
  title: string;
  text: string;
  analysis: AnalysisView | null;
  suggestions: Mention[];
  total: number;
  degraded: 'absent' | 'timeout' | 'error' | null;
  fileId: string | null;
  /** Revue courte dans le fil (message court avec une ou deux suggestions). */
  inline: boolean;
}

type UiError = { kind: 'blocked'; leaks: LeakItem[] } | { kind: 'code'; code: ErrorCode | 'unknown' } | null;

function mergeSegments(prev: Segment[], next: Segment[]): Segment[] {
  const out = prev.map((s) => ({ ...s }));
  for (const s of next) {
    const last = out[out.length - 1];
    if (last && last.restoredFrom === undefined && s.restoredFrom === undefined) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem('ianonyme.theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* stockage indisponible */
  }
  return 'system';
}

const BRIEF_SECONDS = 3;

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [conv, setConv] = useState<ConversationView | null>(null);
  const convRef = useRef<ConversationView | null>(null);
  convRef.current = conv;

  const [text, setText] = useState('');
  const [files, setFiles] = useState<UiFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisView | null>(null);
  const [preview, setPreview] = useState<PreviewView | null>(null);
  const [streaming, setStreaming] = useState<Segment[] | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<UiError>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [dialog, setDialog] = useState<{ preview: PreviewView; original: string } | null>(null);
  const [brief, setBrief] = useState<{ preview: PreviewView; left: number } | null>(null);
  const [screen, setScreen] = useState<'chat' | 'reliability'>('chat');
  const [measure, setMeasure] = useState<MeasureReport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [startupDone, setStartupDone] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [focusEntity, setFocusEntity] = useState<string | null>(null);

  const snapshot = useRef<{ text: string; files: UiFile[] } | null>(null);
  const queue = useRef<File[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const analysisSeq = useRef(0);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  // ---- Thème ----
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') delete el.dataset.theme;
    else el.dataset.theme = theme;
    try {
      localStorage.setItem('ianonyme.theme', theme);
    } catch {
      /* stockage indisponible */
    }
  }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent): void => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ---- Démarrage ----
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const [i, list] = await Promise.all([api.app.info(), api.conversations.list()]);
      setInfo(i);
      if (list.length === 0) {
        const created = await api.conversations.create();
        setConv(created);
        setConvs(await api.conversations.list());
      } else {
        setConvs(list);
        setConv(await api.conversations.get(list[0]!.id));
      }
    })();
  }, []);

  // Tant que l'analyse approfondie se prépare, on interroge régulièrement son état.
  useEffect(() => {
    if (info?.localAnalysis !== 'loading') return;
    const timer = setInterval(() => {
      void api.app.info().then(setInfo);
    }, 1500);
    return () => clearInterval(timer);
  }, [info?.localAnalysis]);

  const refreshList = useCallback(async () => setConvs(await api.conversations.list()), []);

  // ---- Évènements de l'assistant ----
  useEffect(() => {
    const offChunk = api.on.chunk((e) => {
      if (e.convId !== convRef.current?.id) return;
      setStreaming((prev) => mergeSegments(prev ?? [], e.segments));
    });
    const offDone = api.on.done((e: ChatDoneEvent) => {
      if (e.convId !== convRef.current?.id) return;
      setConv(e.view);
      setStreaming(null);
      setPendingUser(null);
      setGenerating(false);
      snapshot.current = null;
      void refreshList();
    });
    const offError = api.on.error((e: ChatErrorEvent) => {
      if (e.convId !== convRef.current?.id) return;
      setStreaming(null);
      setPendingUser(null);
      setGenerating(false);
      if (e.code === 'leak_blocked') {
        if (snapshot.current) {
          setText(snapshot.current.text);
          setFiles(snapshot.current.files);
        }
        setError({ kind: 'blocked', leaks: e.leaks ?? [] });
      } else {
        setError({ kind: 'code', code: e.code });
        void api.conversations.get(e.convId).then(setConv);
      }
      void refreshList();
    });
    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, [refreshList]);

  // ---- Détection instantanée et aperçu du panneau ----
  const readyFileIds = useMemo(() => files.filter((f) => f.stage === 'ready' && f.chip).map((f) => f.chip!.id), [files]);
  useEffect(() => {
    if (!conv) return;
    const seq = ++analysisSeq.current;
    const timer = setTimeout(() => {
      void api.detect.run(conv.id, text).then((a) => {
        if (seq === analysisSeq.current) setAnalysis(a);
      });
      void api.chat.preview(conv.id, text, readyFileIds, 0).then((p) => {
        if (seq === analysisSeq.current) setPreview(p);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [conv?.id, conv?.entities.length, text, readyFileIds, conv]);

  // ---- Compte à rebours de l'aperçu bref ----
  useEffect(() => {
    if (!brief) return;
    if (brief.left <= 0) {
      setBrief(null);
      void doSend();
      return;
    }
    const timer = setTimeout(() => setBrief((b) => (b ? { ...b, left: b.left - 1 } : b)), 1000);
    return () => clearTimeout(timer);
  }, [brief]);

  // ---- Conversations ----
  const resetDraft = (): void => {
    setText('');
    setFiles([]);
    setAnalysis(null);
    setPreview(null);
    setError(null);
    setReview(null);
    setDialog(null);
    setBrief(null);
    setFocusEntity(null);
    queue.current = [];
  };

  const select = async (id: string): Promise<void> => {
    if (generating) return;
    resetDraft();
    setConv(await api.conversations.get(id));
    setScreen('chat');
  };

  const create = async (): Promise<void> => {
    if (generating) return;
    resetDraft();
    setConv(await api.conversations.create());
    await refreshList();
    setScreen('chat');
  };

  const toolAfter = async (list: Promise<ConversationSummary[]>, removedId?: string): Promise<void> => {
    const l = await list;
    setConvs(l);
    if (removedId && convRef.current?.id === removedId) {
      resetDraft();
      if (l[0]) setConv(await api.conversations.get(l[0].id));
      else setConv(await api.conversations.create());
      await refreshList();
    } else if (convRef.current) {
      setConv(await api.conversations.get(convRef.current.id));
    }
  };

  // ---- Décisions de revue ----
  const decide = async (input: Omit<DecideInput, 'convId'>): Promise<ConversationView | null> => {
    if (!conv) return null;
    const view = await api.mentions.decide({ ...input, convId: conv.id });
    setConv(view);
    return view;
  };

  const refreshReview = async (patch?: Partial<ReviewState>, drop?: Mention): Promise<void> => {
    if (!conv || !review) return;
    const next = await api.detect.run(conv.id, review.text, true);
    const covered = (m: Mention): boolean => next.mentions.some((x) => x.status === 'accepted' && m.span.start >= x.span.start && m.span.end <= x.span.end);
    setReview((r) =>
      r
        ? {
            ...r,
            ...patch,
            analysis: next,
            suggestions: (patch?.suggestions ?? r.suggestions).filter((s) => s.id !== drop?.id && !covered(s)),
          }
        : r,
    );
  };

  // ---- Analyse approfondie ----
  const runDeep = async (target: string): Promise<{ suggestions: Mention[]; degraded: ReviewState['degraded'] }> => {
    if (!conv || info?.localAnalysis !== 'ready') return { suggestions: [], degraded: 'absent' };
    setAnalysing(true);
    try {
      const r = await api.llm.propose(conv.id, target);
      return { suggestions: r.mentions.filter((m) => m.status === 'suggested'), degraded: r.degraded ? (r.degradedReason ?? 'error') : null };
    } finally {
      setAnalysing(false);
    }
  };

  const openReview = async (title: string, target: string, fileId: string | null, found: { suggestions: Mention[]; degraded: ReviewState['degraded'] }): Promise<void> => {
    if (!conv) return;
    const { suggestions, degraded } = found;
    const a = await api.detect.run(conv.id, target, true);
    setConv(await api.conversations.get(conv.id));
    setReview({ title, text: target, analysis: a, suggestions, total: suggestions.length + a.conflicts.length, degraded, fileId, inline: false });
  };

  // ---- Fichiers ----
  // L'import et l'analyse des fichiers se font en arrière-plan : aucun volet ne s'ouvre avant « Vérifier ».
  const processing = useRef(false);
  const processOne = async (): Promise<void> => {
    const current = convRef.current;
    const file = queue.current.shift();
    if (!current || !file) return;
    setError(null);
    const uid = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: UiFile = { uid, chip: null, name: file.name, stage: 'reading', reviewed: false, text: '', suggestions: [], degraded: null };
    setFiles((f) => [...f, entry]);
    const patch = (p: Partial<UiFile>): void => setFiles((list) => list.map((x) => (x.uid === uid ? { ...x, ...p } : x)));
    const res = await api.files.import(current.id, file.name, await file.arrayBuffer());
    if (!res.ok || !res.file || res.text === undefined) {
      const reason = res.blocked?.reason ?? 'file_unreadable';
      patch({ stage: 'failed', error: t.file.refused(reason) });
      setError({ kind: 'code', code: reason });
      return;
    }
    patch({ chip: res.file, stage: 'detecting', text: res.text });
    const deepOn = info?.localAnalysis === 'ready';
    if (deepOn) patch({ stage: 'deep' });
    const found = deepOn ? await runDeep(res.text) : { suggestions: [], degraded: 'absent' as const };
    setConv(await api.conversations.get(current.id));
    patch({ stage: 'ready', suggestions: found.suggestions, degraded: found.degraded });
  };
  const drainQueue = async (): Promise<void> => {
    if (processing.current) return;
    processing.current = true;
    try {
      while (queue.current.length > 0) await processOneRef.current();
    } finally {
      processing.current = false;
    }
  };
  // Les gestionnaires asynchrones doivent toujours voir l'état le plus récent.
  const processOneRef = useRef(processOne);
  processOneRef.current = processOne;

  const pickFiles = (picked: File[]): void => {
    queue.current.push(...picked);
    void drainQueue();
  };

  const closeReview = (): void => {
    setReview(null);
  };

  // ---- Envoi ----
  const originalOf = (userText: string, list: UiFile[]): string =>
    composeMessage(userText, list.filter((f) => f.chip).map((f) => ({ readableName: f.chip!.readableName, text: f.text })));

  const doSend = async (regenerate = false): Promise<void> => {
    const current = convRef.current;
    if (!current) return;
    setError(null);
    setDialog(null);
    setBrief(null);
    snapshot.current = { text, files };
    const ids = files.filter((f) => f.chip && f.stage === 'ready').map((f) => f.chip!.id);
    if (!regenerate) setPendingUser(text.trim());
    setGenerating(true);
    setStreaming([]);
    if (!regenerate) {
      setText('');
      setFiles([]);
    }
    await api.chat.send({ convId: current.id, userText: regenerate ? '' : text, fileIds: regenerate ? [] : ids, regenerate });
  };

  const onSend = async (): Promise<void> => {
    if (!conv || !info || generating || analysing) return;
    setError(null);
    const readyFiles = files.filter((f) => f.chip && f.stage === 'ready');
    const unreviewed = readyFiles.find((f) => !f.reviewed);
    if (unreviewed && unreviewed.chip) {
      await openReview(unreviewed.chip.maskedName, unreviewed.text, unreviewed.chip.id, { suggestions: unreviewed.suggestions, degraded: unreviewed.degraded });
      return;
    }
    let pending: Mention[] = [];
    if (text.trim().length > 0 && conv.settings.deepAnalysisOnMessages && info.localAnalysis === 'ready') {
      pending = (await runDeep(text)).suggestions;
    }
    const pv = await api.chat.preview(conv.id, text, readyFileIds, pending.length);
    if (!pv.leak.ok) {
      setError({ kind: 'blocked', leaks: pv.leak.leaks });
      setAnalysis(await api.detect.run(conv.id, text));
      return;
    }
    if (readyFiles.length > 0 && pending.length === 0 && pv.conflicts.length === 0) {
      setDialog({ preview: pv, original: originalOf(text, files) });
      return;
    }
    // Le volet de vérification s'ouvre ici, sur « Vérifier » : s'il y a quelque chose à traiter ou à relire.
    const current = await api.detect.run(conv.id, text);
    if (pv.requiresReview || current.protectedInText > 0) {
      const a = await api.detect.run(conv.id, text, true);
      setConv(await api.conversations.get(conv.id));
      const count = pending.length + a.conflicts.length;
      setReview({ title: '', text, analysis: a, suggestions: pending, total: count, degraded: info.localAnalysis === 'ready' ? null : 'absent', fileId: null, inline: readyFiles.length === 0 && count > 0 && count <= 2 });
      return;
    }
    setBrief({ preview: pv, left: BRIEF_SECONDS });
  };

  const afterReview = async (): Promise<void> => {
    if (!conv || !review) return;
    const isFile = review.fileId !== null;
    if (isFile) setFiles((list) => list.map((f) => (f.chip?.id === review.fileId ? { ...f, reviewed: true } : f)));
    const ids = readyFileIds;
    const pv = await api.chat.preview(conv.id, text, ids, 0);
    setReview(null);
    const nextFile = files.find((f) => f.chip && f.stage === 'ready' && !f.reviewed && f.chip.id !== review.fileId);
    if (nextFile?.chip) {
      await openReview(nextFile.chip.maskedName, nextFile.text, nextFile.chip.id, { suggestions: nextFile.suggestions, degraded: nextFile.degraded });
      return;
    }
    if (!isFile && text.trim().length === 0) return;
    if (isFile && text.trim().length === 0 && ids.length === 0) return;
    if (ids.length === 0) {
      setBrief({ preview: pv, left: BRIEF_SECONDS });
      return;
    }
    setDialog({ preview: pv, original: originalOf(text, files.map((f) => (f.chip?.id === review.fileId ? { ...f, reviewed: true } : f))) });
  };

  const openMessageReview = async (): Promise<void> => {
    if (!conv) return;
    const a = await api.detect.run(conv.id, text, true);
    setConv(await api.conversations.get(conv.id));
    setReview({ title: '', text, analysis: a, suggestions: [], total: a.conflicts.length, degraded: null, fileId: null, inline: false });
  };

  const onProtectLeak = async (): Promise<void> => {
    if (!conv || error?.kind !== 'blocked') return;
    const regexLeaks = error.leaks.filter((l) => l.kind === 'regex' && l.category);
    if (regexLeaks.length > 0) {
      for (const l of regexLeaks) await decide({ action: 'add', text: l.value, category: l.category as Category });
      setError(null);
      setAnalysis(await api.detect.run(conv.id, text));
      return;
    }
    await openMessageReview();
  };

  // ---- Rendu ----
  if (!info || !conv) return <div className="boot" aria-busy="true" />;

  const marks = analysis ? marksFrom(analysis.mentions, analysis.conflicts) : [];
  const toReview = (analysis?.conflicts.length ?? 0) + (review?.suggestions.length ?? 0);
  const blockedValue = error?.kind === 'blocked' ? error.leaks[0]?.value : undefined;
  const provider = info.providers.find((p) => p.id === conv.settings.assistantId);
  const isEmpty = conv.messages.length === 0 && pendingUser === null && streaming === null;

  const errorText = (e: Exclude<UiError, null>): string => {
    if (e.kind === 'blocked') return blockedValue ? t.blocked.banner(blockedValue) : t.blocked.bannerGeneric;
    if (e.code === 'assistant_unreachable') return t.errors.assistantDown;
    if (e.code === 'assistant_not_configured') return t.errors.assistantNotConfigured;
    if (e.code.startsWith('file_')) return t.file.refused(e.code as ErrorCode);
    return t.errors.internal;
  };

  return (
    <div className={`app${sidebarCollapsed ? ' app-side-collapsed' : ''}${panelCollapsed ? ' app-panel-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        conversations={convs}
        activeId={conv.id}
        onSelect={(id) => void select(id)}
        onCreate={() => void create()}
        onRename={(id, title) => void toolAfter(api.conversations.rename(id, title))}
        onRemove={(id) => void toolAfter(api.conversations.remove(id), id)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenReliability={() => {
          void api.app.measure().then(setMeasure);
          setScreen('reliability');
        }}
        info={info}
        dark={dark}
      />

      {screen === 'reliability' ? (
        <Reliability report={measure} onBack={() => setScreen('chat')} />
      ) : (
        <main className="main" aria-label={conv.title}>
          <header className="conv-head">
            <h1 className="conv-title-h">{conv.title}</h1>
            <label className="assistant-pick">
              <span>{t.conversation.assistant} :</span>
              <select
                value={conv.settings.assistantId}
                onChange={(e) => void api.settings.update({ convId: conv.id, assistantId: e.target.value }).then(setConv)}
                data-testid="assistant-select"
                aria-label={t.conversation.assistant}
              >
                {info.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {provider?.simulated && <span className="pill pill-neutral">{t.conversation.simulatedBadge}</span>}
            </label>
          </header>

          {isEmpty ? (
            <section className="empty" data-testid="empty">
              <h2>{t.conversation.emptyTitle}</h2>
              <ul className="task-list">
                {(['summary', 'timeline', 'contradictions'] as const).map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      className="task-btn"
                      onClick={() => {
                        setText(t.tasks[k].prompt);
                        inputRef.current?.focus();
                      }}
                      data-testid={`task-${k}`}
                    >
                      {t.tasks[k].label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <Thread conv={conv} streaming={streaming} pendingUser={pendingUser} generating={generating} focusEntity={focusEntity} onRegenerate={() => void doSend(true)} />
          )}

          <div className="dock">
            {error && (
              <div className={`banner ${error.kind === 'blocked' ? 'banner-red' : 'banner-amber'}`} role="alert" data-testid="banner">
                <TriangleAlert size={16} aria-hidden />
                <span className="banner-text">{errorText(error)}</span>
                {error.kind === 'blocked' ? (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void onProtectLeak()} data-testid="blocked-protect">
                      {t.blocked.protect}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(null); inputRef.current?.focus(); }} data-testid="blocked-edit">
                      {t.blocked.edit}
                    </button>
                  </>
                ) : (
                  <button type="button" className="icon-btn" aria-label={t.errors.dismiss} onClick={() => setError(null)}>
                    <X size={14} aria-hidden />
                  </button>
                )}
              </div>
            )}
            {review?.inline && (
              <InlineReview
                analysis={review.analysis}
                suggestions={review.suggestions}
                entities={conv.entities}
                onProtect={(m, entityId) => void decide({ action: 'accept', mention: m, entityId }).then(() => refreshReview(undefined, m))}
                onIgnore={(m) => void decide({ action: 'reject', mention: m }).then(() => refreshReview(undefined, m))}
                onLink={(m, entityId) => void decide({ action: 'link', mention: m, entityId }).then(() => refreshReview(undefined, m))}
                onCancel={closeReview}
                onContinue={() => void afterReview()}
              />
            )}
            {brief && (
              <div className="brief" role="status" data-testid="brief">
                <div className="brief-head">
                  <strong>{t.composer.briefPreviewTitle}</strong>
                  <span className="text-2">{t.composer.briefPreviewCountdown(brief.left)}</span>
                </div>
                <pre className="received-text">
                  <ProtectedText text={brief.preview.maskedCurrent} />
                </pre>
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBrief(null)} data-testid="brief-cancel">
                    {t.composer.cancel}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => { setBrief(null); void doSend(); }} data-testid="brief-send">
                    {t.composer.sendNow}
                  </button>
                </div>
              </div>
            )}
            <div className={error?.kind === 'blocked' ? 'blocked-field' : undefined}>
              <Composer
                value={text}
                marks={marks}
                files={files}
                protectedCount={analysis?.protectedInText ?? 0}
                busy={brief !== null || analysing}
                generating={generating}
                analysing={analysing}
                inputRef={inputRef}
                onChange={(v) => {
                  setText(v);
                  if (error?.kind === 'blocked') setError(null);
                }}
                onSend={() => void onSend()}
                onStop={() => void api.chat.stop(conv.id)}
                onSkipAnalysis={() => void api.llm.skip(conv.id)}
                onPickFiles={pickFiles}
                onRemoveFile={(i) => {
                  const f = files[i];
                  if (f?.chip) void api.files.discard(conv.id, f.chip.id);
                  setFiles(files.filter((_, k) => k !== i));
                }}
              />
            </div>
          </div>
        </main>
      )}

      <ProtectionPanel
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed(!panelCollapsed)}
        entities={conv.entities}
        toReview={toReview}
        onOpenReview={() => void openMessageReview()}
        focusEntity={focusEntity}
        onFocusEntity={setFocusEntity}
        preview={preview}
        info={info}
        deepAnalysis={conv.settings.deepAnalysisOnMessages}
        onToggleDeep={(v) => void api.settings.update({ convId: conv.id, deepAnalysisOnMessages: v }).then(setConv)}
      />

      {review && !review.inline && (
        <Review
          title={review.title || t.conversation.youLabel}
          text={review.text}
          analysis={review.analysis}
          suggestions={review.suggestions}
          entities={conv.entities}
          total={review.total}
          running={false}
          degraded={review.degraded}
          onProtect={(m, entityId) => void decide({ action: 'accept', mention: m, entityId }).then(() => refreshReview(undefined, m))}
          onIgnore={(m) => void decide({ action: 'reject', mention: m }).then(() => refreshReview(undefined, m))}
          onLink={(m, entityId) => void decide({ action: 'link', mention: m, entityId }).then(() => refreshReview(undefined, m))}
          onAddManual={(value, category) => void decide({ action: 'add', text: value, category }).then(() => refreshReview())}
          onCancel={closeReview}
          onContinue={() => void afterReview()}
          onSeeReceived={() => void afterReview()}
        />
      )}

      {dialog && (
        <PreviewDialog
          preview={dialog.preview}
          originalText={dialog.original}
          sending={generating}
          onBack={() => setDialog(null)}
          onSend={() => void doSend()}
        />
      )}

      {info.localAnalysis === 'loading' && !startupDone && <Startup dark={dark} onContinueBasic={() => setStartupDone(true)} />}

      {aboutOpen && <About dark={dark} onClose={() => setAboutOpen(false)} />}

      {settingsOpen && (
        <Settings
          info={info}
          conv={conv}
          theme={theme}
          onTheme={setTheme}
          onAssistant={(id) => void api.settings.update({ convId: conv.id, assistantId: id }).then(setConv)}
          onClear={() => {
            void api.conversations.clear(conv.id).then((v) => {
              resetDraft();
              setConv(v);
              void refreshList();
              setSettingsOpen(false);
            });
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
