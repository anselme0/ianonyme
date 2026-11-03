import { Info, Pencil, PanelLeftClose, PanelLeftOpen, Plus, Settings, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import type { AppInfo, ConversationSummary } from '../../shared/api.js';
import iconDark from '../assets/icon-dark.svg';
import icon from '../assets/icon.svg';
import { t } from '../messages.js';

interface Props {
  collapsed: boolean;
  onToggle(): void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect(id: string): void;
  onCreate(): void;
  onRename(id: string, title: string): void;
  onRemove(id: string): void;
  onOpenSettings(): void;
  onOpenAbout(): void;
  info: AppInfo;
  dark: boolean;
}

export function Sidebar(p: Props) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const logo = p.dark ? iconDark : icon;

  if (p.collapsed) {
    return (
      <nav className="sidebar sidebar-collapsed" aria-label={t.app.name}>
        <img src={logo} width={28} height={28} alt={t.app.name} />
        <button type="button" className="icon-btn" aria-label={t.sidebar.expand} title={t.sidebar.expand} onClick={p.onToggle}>
          <PanelLeftOpen size={18} aria-hidden />
        </button>
        <button type="button" className="icon-btn" aria-label={t.sidebar.newConversation} title={t.sidebar.newConversation} onClick={p.onCreate}>
          <Plus size={18} aria-hidden />
        </button>
      </nav>
    );
  }

  const commit = (id: string): void => {
    if (draft.trim().length > 0) p.onRename(id, draft);
    setEditing(null);
  };

  return (
    <nav className="sidebar" aria-label={t.app.name} data-testid="sidebar">
      <div className="sidebar-head">
        <img src={logo} width={28} height={28} alt="" />
        <span className="brand">{t.app.name}</span>
        <button type="button" className="icon-btn" aria-label={t.sidebar.collapse} title={t.sidebar.collapse} onClick={p.onToggle}>
          <PanelLeftClose size={18} aria-hidden />
        </button>
      </div>
      <button type="button" className="btn btn-secondary new-conv" onClick={p.onCreate} data-testid="new-conversation">
        <Plus size={16} aria-hidden /> {t.sidebar.newConversation}
      </button>
      <h2 className="sidebar-group">{t.sidebar.today}</h2>
      <ul className="conv-list">
        {p.conversations.map((c) => (
          <li key={c.id} className={c.id === p.activeId ? 'conv conv-on' : 'conv'}>
            {editing === c.id ? (
              <input
                className="conv-edit"
                autoFocus
                value={draft}
                aria-label={t.conversation.renameTitle}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(c.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <>
                <button type="button" className="conv-title" onClick={() => p.onSelect(c.id)} data-testid="conversation-item">
                  {c.title}
                </button>
                <span className="conv-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.sidebar.rename}
                    title={t.sidebar.rename}
                    onClick={() => {
                      setDraft(c.title);
                      setEditing(c.id);
                    }}
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button type="button" className="icon-btn" aria-label={t.sidebar.remove} title={t.sidebar.remove} onClick={() => p.onRemove(c.id)}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        {menu && (
          <div className="popover" role="menu">
            <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); p.onOpenSettings(); }} data-testid="menu-settings">
              <Settings size={16} aria-hidden /> {t.sidebar.settings}
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); p.onOpenAbout(); }} data-testid="menu-about">
              <Info size={16} aria-hidden /> {t.sidebar.about}
            </button>
          </div>
        )}
        <button type="button" className="user-btn" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={t.sidebar.userMenu} data-testid="user-menu">
          <User size={16} aria-hidden /> <span>{p.info.user.name}</span>
          <Settings size={16} aria-hidden className="push" />
        </button>
      </div>
    </nav>
  );
}
