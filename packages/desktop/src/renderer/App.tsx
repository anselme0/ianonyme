import { TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../shared/api.js';
import { api } from './api.js';
import { About } from './components/About.js';
import { Composer } from './components/Composer.js';
import type { ComposerFile } from './components/Composer.js';
import { ProtectionPanel } from './components/ProtectionPanel.js';
import { Review } from './components/Review.js';
import type { ReviewTab } from './components/Review.js';
import { Settings } from './components/Settings.js';
import type { ThemeChoice } from './components/Settings.js';
import { Sidebar } from './components/Sidebar.js';
import { Startup } from './components/Startup.js';
import { Thread } from './components/Thread.js';
import { marksFrom } from './marks.js';
import { t } from './messages.js';

type Degraded = 'absent' | 'timeout' | 'error' | null;

type UiFile = ComposerFile & {
  uid: string;
  text: string;
  /** Cas ambigus laissés par l'analyse approfondie, à traiter à la vérification. */
  suggestions: Mention[];
  degraded: Degraded;
  /** Fichier Word d'origine, pour l'afficher comme dans Word à la vérification. */
  buffer?: ArrayBuffer;
};

interface ReviewState {
  tabs: ReviewTab[];
  active: number;
  degraded: Degraded;
  /** L'analyse approfondie se poursuit : les résultats arrivent dans le volet au fur et à mesure. */
  running: boolean;
}

interface DeepResult {
  suggestions: Mention[];
  degraded: Degraded;
}

interface Prepared {
  text: string;
  files: UiFile[];
  message: DeepResult;
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

// Délais avant l'analyse approfondie en arrière-plan : court après une ponctuation ou un espace,
// plus long au milieu d'un mot (le mot n'est probablement pas fini).
const BACKGROUND_DELAY_MS = 1500;
const BACKGROUND_DELAY_MID_WORD_MS = 5000;
const BACKGROUND_MIN_CHARS = 8;

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [conv, setConv] = useState<ConversationView | null>(null);
  const convRef = useRef<ConversationView | null>(null);
  convRef.current = conv;

  const [text, setText] = useState('');
  const [files, setFiles] = useState<UiFile[]>([]);
  const filesRef = useRef<UiFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisView | null>(null);
  const [streaming, setStreaming] = useState<Segment[] | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  /** Analyses approfondies en cours en arrière-plan. */
  const [background, setBackground] = useState(0);
  /** « Envoyer » est en attente de la fin de l'analyse : l'envoi partira tout seul. */
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<UiError>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const reviewRef = useRef<ReviewState | null>(null);
  reviewRef.current = review;
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
  const latestText = useRef('');
  latestText.current = text;
  const deepCache = useRef(new Map<string, DeepResult>());
  const deepChain = useRef<Promise<unknown>>(Promise.resolve());
  const drainRef = useRef<Promise<void>>(Promise.resolve());
  const processing = useRef(false);
  const queueToken = useRef(0);
  const verifySeq = useRef(0);
  /** Ferme le volet et rend caduques les résultats d'analyse encore attendus pour lui. */
  const closeReview = (): void => {
    verifySeq.current++;
    setReview(null);
  };

  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  const updateFiles = (change: (list: UiFile[]) => UiFile[]): void => {
    filesRef.current = change(filesRef.current);
    setFiles(filesRef.current);
  };

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
          const saved = snapshot.current.files;
          filesRef.current = saved;
          setFiles(saved);
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

  // ---- Détection instantanée (règles et variantes) pour le surlignage ----
  useEffect(() => {
    if (!conv) return;
    const seq = ++analysisSeq.current;
    const timer = setTimeout(() => {
      void api.detect.run(conv.id, text).then((a) => {
        if (seq === analysisSeq.current) setAnalysis(a);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [conv?.id, conv?.entities.length, text, conv]);

  // ---- Analyse approfondie ----
  // Les analyses s'enchaînent l'une après l'autre (un seul modèle). Le résultat est gardé par texte :
  // si l'utilisateur clique sur Vérifier ou Envoyer après l'analyse en arrière-plan, rien n'est refait.
  const deepAnalyse = (target: string, skipIfStale: boolean): Promise<DeepResult> => {
    const current = convRef.current;
    if (!current || info?.localAnalysis !== 'ready') return Promise.resolve({ suggestions: [], degraded: 'absent' });
    const key = `${current.id}\u0000${target}`;
    const cached = deepCache.current.get(key);
    if (cached) return Promise.resolve(cached);
    const job = deepChain.current.then(async (): Promise<DeepResult> => {
      const again = deepCache.current.get(key);
      if (again) return again;
      if (skipIfStale && latestText.current !== target) return { suggestions: [], degraded: null };
      setBackground((n) => n + 1);
      try {
        const r = await api.llm.propose(current.id, target);
        const result: DeepResult = {
          suggestions: r.mentions.filter((m) => m.status === 'suggested'),
          degraded: r.degraded ? (r.degradedReason ?? 'error') : null,
        };
        if (!r.degraded) deepCache.current.set(key, result);
        return result;
      } finally {
        setBackground((n) => n - 1);
      }
    });
    deepChain.current = job.catch(() => undefined);
    return job;
  };

  // Pendant la frappe : l'analyse approfondie tourne en arrière-plan et le surlignage suit.
  useEffect(() => {
    if (!conv || generating || info?.localAnalysis !== 'ready') return;
    const target = text;
    if (target.trim().length < BACKGROUND_MIN_CHARS) return;
    const midWord = /[\p{L}\p{N}]$/u.test(target);
    const timer = setTimeout(
      () => {
        void deepAnalyse(target, true).then(async () => {
          if (convRef.current?.id === conv.id && latestText.current === target) setConv(await api.conversations.get(conv.id));
        });
      },
      midWord ? BACKGROUND_DELAY_MID_WORD_MS : BACKGROUND_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, conv?.id, info?.localAnalysis, generating]);

  // ---- Conversations ----
  const resetDraft = (): void => {
    setText('');
    updateFiles(() => []);
    setAnalysis(null);
    setError(null);
    closeReview();
    setFocusEntity(null);
    deepCache.current.clear();
    queue.current = [];
  };

  const select = async (id: string): Promise<void> => {
    if (generating) return;
    resetDraft();
    setConv(await api.conversations.get(id));
  };

  const create = async (): Promise<void> => {
    if (generating) return;
    resetDraft();
    setConv(await api.conversations.create());
    await refreshList();
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

  /** Recalcule tous les onglets après une décision ; `drop` retire la suggestion traitée de l'onglet actif. */
  const refreshReview = async (drop?: Mention): Promise<void> => {
    const r = reviewRef.current;
    const current = convRef.current;
    if (!r || !current) return;
    const tabs = await Promise.all(
      r.tabs.map(async (tab, index) => {
        const next = await api.detect.run(current.id, tab.text, true);
        const covered = (m: Mention): boolean => next.mentions.some((x) => x.status === 'accepted' && m.span.start >= x.span.start && m.span.end <= x.span.end);
        const suggestions = tab.suggestions.filter((s) => !(index === r.active && s.id === drop?.id) && !covered(s));
        // Ce qui est traité ne revient pas à la prochaine vérification.
        if (tab.key === 'message') deepCache.current.set(`${current.id}\u0000${tab.text}`, { suggestions, degraded: null });
        else updateFiles((list) => list.map((f) => (f.uid === tab.key ? { ...f, suggestions } : f)));
        return { ...tab, analysis: next, suggestions };
      }),
    );
    setReview((prev) => (prev ? { ...prev, tabs } : prev));
    setConv(await api.conversations.get(current.id));
  };

  const onDecision = (input: Omit<DecideInput, 'convId'>, drop?: Mention): void => {
    void decide(input).then(() => refreshReview(drop));
  };

  // ---- Fichiers ----
  // L'import et l'analyse des fichiers se font en arrière-plan : aucun volet ne s'ouvre avant « Vérifier ».
  const processOne = async (): Promise<void> => {
    const current = convRef.current;
    const file = queue.current.shift();
    if (!current || !file) return;
    setError(null);
    const uid = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: UiFile = { uid, chip: null, name: file.name, stage: 'reading', text: '', suggestions: [], degraded: null };
    updateFiles((f) => [...f, entry]);
    const patch = (p: Partial<UiFile>): void => updateFiles((list) => list.map((x) => (x.uid === uid ? { ...x, ...p } : x)));
    const bytes = await file.arrayBuffer();
    const res = await api.files.import(current.id, file.name, bytes);
    if (!res.ok || !res.file || res.text === undefined) {
      const reason = res.blocked?.reason ?? 'file_unreadable';
      patch({ stage: 'failed', error: t.file.refused(reason) });
      setError({ kind: 'code', code: reason });
      return;
    }
    patch({ chip: res.file, stage: 'detecting', text: res.text, ...(/\.docx$/i.test(file.name) ? { buffer: bytes } : {}) });
    if (info?.localAnalysis === 'ready') patch({ stage: 'deep' });
    const found = await deepAnalyse(res.text, false);
    setConv(await api.conversations.get(current.id));
    patch({ stage: 'ready', suggestions: found.suggestions, degraded: found.degraded });
  };
  const processOneRef = useRef(processOne);
  processOneRef.current = processOne;

  const drainQueue = (): void => {
    if (processing.current) return;
    processing.current = true;
    drainRef.current = (async () => {
      try {
        while (queue.current.length > 0) await processOneRef.current();
      } finally {
        processing.current = false;
      }
    })();
  };

  const pickFiles = (picked: File[]): void => {
    queue.current.push(...picked);
    drainQueue();
  };

  // ---- Envoi et vérification ----
  const doSend = async (): Promise<void> => {
    const current = convRef.current;
    if (!current) return;
    setError(null);
    closeReview();
    snapshot.current = { text, files: filesRef.current };
    const ids = filesRef.current.filter((f) => f.chip && f.stage === 'ready').map((f) => f.chip!.id);
    setPendingUser(text.trim());
    setGenerating(true);
    setStreaming([]);
    setText('');
    updateFiles(() => []);
    await api.chat.send({ convId: current.id, userText: text, fileIds: ids, regenerate: false });
  };

  const doRegenerate = async (): Promise<void> => {
    const current = convRef.current;
    if (!current) return;
    setError(null);
    snapshot.current = { text, files: filesRef.current };
    setGenerating(true);
    setStreaming([]);
    await api.chat.send({ convId: current.id, userText: '', fileIds: [], regenerate: true });
  };

  /** Attend la fin de la lecture des fichiers et de l'analyse approfondie du message. */
  const gather = async (): Promise<Prepared> => {
    await drainRef.current;
    const message: DeepResult = text.trim().length > 0 ? await deepAnalyse(text, false) : { suggestions: [], degraded: null };
    return { text, files: filesRef.current.filter((f) => f.chip && f.stage === 'ready'), message };
  };

  /** Vrai quand il faut encore attendre : un fichier en cours de lecture ou l'analyse du message. */
  const analysisPending = (): boolean => {
    const id = convRef.current?.id ?? '';
    const messagePending = text.trim().length > 0 && info?.localAnalysis === 'ready' && !deepCache.current.has(`${id}\u0000${text}`);
    return messagePending || processing.current;
  };

  const buildTabs = async (p: Prepared): Promise<ReviewTab[]> => {
    const current = convRef.current!;
    const tabs: ReviewTab[] = [];
    const make = async (key: string, title: string, body: string, suggestions: Mention[], buffer?: ArrayBuffer): Promise<ReviewTab> => {
      const a = await api.detect.run(current.id, body, true);
      const covered = (m: Mention): boolean => a.mentions.some((x) => x.status === 'accepted' && m.span.start >= x.span.start && m.span.end <= x.span.end);
      const open = suggestions.filter((s) => !covered(s));
      return { key, title, text: body, analysis: a, suggestions: open, total: open.length + a.conflicts.length, ...(buffer ? { buffer } : {}) };
    };
    if (p.text.trim().length > 0) tabs.push(await make('message', t.review.messageTab, p.text, p.message.suggestions));
    for (const f of p.files) tabs.push(await make(f.uid, f.name, f.text, f.suggestions, f.buffer));
    return tabs;
  };

  const degradedOf = (p: Prepared): Degraded => {
    if (info?.localAnalysis !== 'ready') return 'absent';
    return p.message.degraded ?? p.files.find((f) => f.degraded)?.degraded ?? null;
  };

  const openReview = async (p: Prepared, running = false, keepActive = false): Promise<void> => {
    const tabs = await buildTabs(p);
    setConv(await api.conversations.get(convRef.current!.id));
    setReview((prev) => ({ tabs, active: keepActive && prev ? Math.min(prev.active, tabs.length - 1) : 0, degraded: degradedOf(p), running }));
  };

  /**
   * « Vérifier » ouvre le volet tout de suite ; si l'analyse approfondie n'est pas finie, ses résultats
   * s'ajoutent au volet dès qu'ils arrivent. Rien n'est bloqué et aucun choix n'est imposé.
   */
  const onVerify = async (): Promise<void> => {
    if (!convRef.current || !info || generating) return;
    queueToken.current++;
    setQueued(false);
    setError(null);
    const mine = ++verifySeq.current;
    const cached = deepCache.current.get(`${convRef.current.id}\u0000${text}`);
    const pending = analysisPending();
    await openReview({ text, files: filesRef.current.filter((f) => f.chip && f.stage === 'ready'), message: cached ?? { suggestions: [], degraded: null } }, pending);
    if (!pending) return;
    const full = await gather();
    // Le volet a pu être fermé ou rouvert entre-temps.
    if (verifySeq.current === mine) await openReview(full, false, true);
  };

  /**
   * « Envoyer » : mêmes vérifications que « Vérifier », sans les montrer sauf en cas de doute. Si l'analyse n'est
   * pas finie, l'envoi est mis en attente et part tout seul (annulable) : on ne peut pas envoyer avant la protection.
   */
  const onSend = async (): Promise<void> => {
    if (!convRef.current || !info || generating || queued) return;
    setError(null);
    const token = ++queueToken.current;
    if (analysisPending()) setQueued(true);
    const p = await gather();
    if (queueToken.current !== token) return;
    setQueued(false);
    if (!convRef.current) return;
    const current = convRef.current;
    const pending = p.message.suggestions.length + p.files.reduce((n, f) => n + f.suggestions.length, 0);
    const pv = await api.chat.preview(current.id, p.text, p.files.map((f) => f.chip!.id), pending);
    if (!pv.leak.ok) {
      setError({ kind: 'blocked', leaks: pv.leak.leaks });
      setAnalysis(await api.detect.run(current.id, p.text));
      return;
    }
    if (pending + pv.conflicts.length > 0) {
      await openReview(p);
      return;
    }
    await doSend();
  };

  /** « Envoyer » depuis le volet de vérification. */
  const afterReview = async (): Promise<void> => {
    const current = convRef.current;
    if (!current) return;
    const ready = filesRef.current.filter((f) => f.chip && f.stage === 'ready');
    const pv = await api.chat.preview(current.id, text, ready.map((f) => f.chip!.id), 0);
    if (!pv.leak.ok) {
      closeReview();
      setError({ kind: 'blocked', leaks: pv.leak.leaks });
      return;
    }
    await doSend();
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
    await openReview({ text, files: filesRef.current.filter((f) => f.chip && f.stage === 'ready'), message: { suggestions: [], degraded: null } });
  };

  // ---- Rendu ----
  if (!info || !conv) return <div className="boot" aria-busy="true" />;

  const marks = analysis ? marksFrom(analysis.mentions, analysis.conflicts) : [];
  const toReview = (analysis?.conflicts.length ?? 0) + files.reduce((n, f) => n + f.suggestions.length, 0);
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
        info={info}
        dark={dark}
      />

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
          <Thread conv={conv} streaming={streaming} pendingUser={pendingUser} generating={generating} focusEntity={focusEntity} onRegenerate={() => void doRegenerate()} />
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
          <div className={error?.kind === 'blocked' ? 'blocked-field' : undefined}>
            <Composer
              value={text}
              marks={marks}
              files={files}
              protectedCount={analysis?.protectedInText ?? 0}
              queued={queued}
              generating={generating}
              analysing={background > 0}
              inputRef={inputRef}
              onChange={(v) => {
                if (queued) {
                  queueToken.current++;
                  setQueued(false);
                }
                setText(v);
                if (error?.kind === 'blocked') setError(null);
              }}
              onSend={() => void onSend()}
              onVerify={() => void onVerify()}
              onStop={() => void api.chat.stop(conv.id)}
              onCancelQueued={() => {
                queueToken.current++;
                setQueued(false);
              }}
              onPickFiles={pickFiles}
              onRemoveFile={(i) => {
                const f = files[i];
                if (f?.chip) void api.files.discard(conv.id, f.chip.id);
                updateFiles((list) => list.filter((_, k) => k !== i));
              }}
            />
          </div>
        </div>
      </main>

      <ProtectionPanel
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed(!panelCollapsed)}
        entities={conv.entities}
        toReview={toReview}
        onOpenReview={() => void onVerify()}
        focusEntity={focusEntity}
        onFocusEntity={setFocusEntity}
        info={info}
      />

      {review && review.tabs.length > 0 && (
        <Review
          tabs={review.tabs}
          active={review.active}
          onTab={(i) => setReview((r) => (r ? { ...r, active: i } : r))}
          entities={conv.entities}
          running={review.running}
          degraded={review.degraded}
          onProtect={(m, entityId) => onDecision({ action: 'accept', mention: m, entityId }, m)}
          onIgnore={(m) => onDecision({ action: 'reject', mention: m }, m)}
          onLink={(m, entityId) => onDecision({ action: 'link', mention: m, entityId }, m)}
          onAddManual={(value, category, entityId) => onDecision({ action: 'add', text: value, category, entityId })}
          onCancel={() => closeReview()}
          onContinue={() => void afterReview()}
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
