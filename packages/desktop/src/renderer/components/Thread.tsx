import { Check, Copy, RefreshCw, TriangleAlert, FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Segment } from 'engine';
import type { ConversationView, EntityView, MessageView } from '../../shared/api.js';
import { t } from '../messages.js';

const TOKEN_RE = /ZqRst(\d+)Zq/g;

export interface RestoredValue {
  text: string;
  entityId: string;
}

/**
 * Chaîne Markdown où chaque valeur restituée est remplacée par un jeton inerte (lettres et chiffres).
 * La valeur ne passe donc jamais par l'analyseur Markdown (pas de lien automatique ni de mise en forme
 * parasite) ; elle est réinsérée, soulignée, après l'analyse.
 */
export function segmentsToMarkdown(segments: Segment[]): { markdown: string; values: RestoredValue[] } {
  const values: RestoredValue[] = [];
  const markdown = segments
    .map((s) => {
      if (!s.restoredFrom) return s.text;
      values.push({ text: s.text, entityId: s.restoredFrom });
      return `ZqRst${values.length - 1}Zq`;
    })
    .join('');
  return { markdown, values };
}

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Plugin rehype : remplace chaque jeton par un élément souligné avec info-bulle. */
function rehypeRestored(values: RestoredValue[], titleFor: (entityId: string) => string) {
  const visit = (node: HastNode): void => {
    if (!node.children) return;
    const next: HastNode[] = [];
    for (const child of node.children) {
      if (child.type === 'text' && child.value && child.value.includes('ZqRst')) {
        let cursor = 0;
        for (const m of child.value.matchAll(TOKEN_RE)) {
          const v = values[Number(m[1])];
          if (!v) continue;
          if (m.index > cursor) next.push({ type: 'text', value: child.value.slice(cursor, m.index) });
          next.push({
            type: 'element',
            tagName: 'span',
            properties: { className: ['restored'], title: titleFor(v.entityId), 'data-restored': v.entityId },
            children: [{ type: 'text', value: v.text }],
          });
          cursor = m.index + m[0].length;
        }
        if (cursor < child.value.length) next.push({ type: 'text', value: child.value.slice(cursor) });
      } else {
        visit(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return () => (tree: HastNode) => visit(tree);
}

export function AssistantText({ segments, entities }: { segments: Segment[]; entities: EntityView[] }) {
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e.placeholder])), [entities]);
  const { markdown, values } = useMemo(() => segmentsToMarkdown(segments), [segments]);
  const plugin = useMemo(
    () => rehypeRestored(values, (id) => t.conversation.restoredFrom(byId.get(id) ?? '[…]')),
    [byId, values],
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[plugin as never]}
      components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link-btn"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {done ? t.conversation.copied : t.conversation.copy}
    </button>
  );
}

interface Props {
  conv: ConversationView;
  streaming: Segment[] | null;
  pendingUser: string | null;
  generating: boolean;
  onRegenerate(): void;
  focusEntity: string | null;
}

export function Thread({ conv, streaming, pendingUser, generating, onRegenerate, focusEntity }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [conv.messages.length, streaming, pendingUser]);

  const firstRestored = conv.messages.findIndex((m) => m.role === 'assistant' && m.segments?.some((s) => s.restoredFrom));
  const lastAssistant = [...conv.messages].reverse().find((m) => m.role === 'assistant')?.id;
  const focus = conv.entities.find((e) => e.id === focusEntity)?.canonical;

  const userText = (m: MessageView): React.ReactNode => {
    if (!focus) return m.text;
    const parts = m.text.split(new RegExp(`(${focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === focus.toLowerCase() ? (
        <mark key={i} className="mark fam-personnes mark-protected">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="thread" data-testid="thread">
      <div className="thread-inner">
        {conv.messages.map((m, index) => (
          <article key={m.id} className={`msg msg-${m.role}`} data-testid={`msg-${m.role}`}>
            <h3 className="msg-who">{m.role === 'user' ? t.conversation.youLabel : t.conversation.assistantLabel}</h3>
            {m.role === 'user' ? (
              <div className="msg-text user-text">{userText(m)}</div>
            ) : (
              <div className="msg-text md" data-testid="assistant-text">
                <AssistantText segments={m.segments ?? [{ text: m.text }]} entities={conv.entities} />
              </div>
            )}
            {m.files && m.files.length > 0 && (
              <p className="msg-files">
                <FileText size={14} aria-hidden /> {t.conversation.attachedFile}
              </p>
            )}
            {m.role === 'assistant' && index === firstRestored && (
              <p className="notice" data-testid="restored-notice">
                {t.conversation.restoredNotice}
              </p>
            )}
            {m.role === 'assistant' && (m.anomalyCount ?? 0) > 0 && (
              <p className="pill pill-amber" role="status" data-testid="anomaly">
                <TriangleAlert size={14} aria-hidden /> {t.conversation.anomaly}
              </p>
            )}
            {m.role === 'assistant' && m.text.length > 0 && (
              <div className="msg-actions">
                <CopyButton text={m.text} />
                {m.id === lastAssistant && !generating && (
                  <button type="button" className="link-btn" onClick={onRegenerate} data-testid="regenerate">
                    <RefreshCw size={14} aria-hidden /> {t.conversation.regenerate}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
        {pendingUser !== null && (
          <article className="msg msg-user" data-testid="msg-user-pending">
            <h3 className="msg-who">{t.conversation.youLabel}</h3>
            <div className="msg-text user-text">{pendingUser}</div>
          </article>
        )}
        {streaming !== null && (
          <article className="msg msg-assistant" data-testid="msg-streaming">
            <h3 className="msg-who">{t.conversation.assistantLabel}</h3>
            <div className="msg-text md">
              {streaming.length > 0 ? <AssistantText segments={streaming} entities={conv.entities} /> : <span className="text-2">{t.conversation.generating}</span>}
            </div>
          </article>
        )}
        <div ref={end} />
      </div>
    </div>
  );
}
