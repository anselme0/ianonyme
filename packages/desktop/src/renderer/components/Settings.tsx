import { X } from 'lucide-react';
import { useState } from 'react';
import type { AppInfo, ConversationView } from '../../shared/api.js';
import { t } from '../messages.js';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface Props {
  info: AppInfo;
  conv: ConversationView | null;
  theme: ThemeChoice;
  onTheme(theme: ThemeChoice): void;
  onAssistant(id: string): void;
  onClear(): void;
  onClose(): void;
}

type Section = 'assistant' | 'data' | 'appearance' | 'account';

export function Settings({ info, conv, theme, onTheme, onAssistant, onClear, onClose }: Props) {
  const [section, setSection] = useState<Section>('assistant');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="modal-backdrop">
      <div className="modal settings" role="dialog" aria-modal="true" aria-label={t.settings.title} data-testid="settings">
        <header className="modal-head">
          <h2>{t.settings.title}</h2>
          <button type="button" className="icon-btn" aria-label={t.settings.close} onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="settings-body">
          <nav className="settings-nav" aria-label={t.settings.title}>
            {(Object.keys(t.settings.sections) as Section[]).map((s) => (
              <button key={s} type="button" className={s === section ? 'nav-item nav-on' : 'nav-item'} onClick={() => setSection(s)}>
                {t.settings.sections[s]}
              </button>
            ))}
          </nav>
          <div className="settings-pane">
            {section === 'assistant' && (
              <fieldset>
                <legend>{t.settings.sections.assistant}</legend>
                <p className="text-2 small">{t.settings.assistantHelp}</p>
                {info.providers.map((p) => (
                  <label key={p.id} className="radio">
                    <input type="radio" name="assistant" checked={conv?.settings.assistantId === p.id} onChange={() => onAssistant(p.id)} />
                    <span>{p.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {section === 'data' && (
              <div>
                <h3>{t.settings.sections.data}</h3>
                <p className="text-2">{t.settings.dataNote}</p>
                {confirm ? (
                  <button type="button" className="btn btn-danger" onClick={() => { onClear(); setConfirm(false); }} data-testid="confirm-clear">
                    {t.settings.dataClearConfirm}
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirm(true)} disabled={!conv} data-testid="clear-conversation">
                    {t.settings.dataClear}
                  </button>
                )}
              </div>
            )}
            {section === 'appearance' && (
              <fieldset>
                <legend>{t.settings.sections.appearance}</legend>
                {(['light', 'dark', 'system'] as ThemeChoice[]).map((c) => (
                  <label key={c} className="radio">
                    <input type="radio" name="theme" checked={theme === c} onChange={() => onTheme(c)} data-testid={`theme-${c}`} />
                    <span>{c === 'light' ? t.settings.themeLight : c === 'dark' ? t.settings.themeDark : t.settings.themeSystem}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {section === 'account' && (
              <div>
                <h3>{t.settings.sections.account}</h3>
                <dl className="account">
                  <dt>{t.sidebar.userMenu}</dt>
                  <dd>{info.user.name}</dd>
                  <dt>{t.settings.accountFirm}</dt>
                  <dd>{info.user.firm}</dd>
                  <dt>{t.settings.accountEmail}</dt>
                  <dd>{info.user.email}</dd>
                </dl>
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary">
                    {t.settings.accountEdit}
                  </button>
                  <button type="button" className="btn btn-secondary">
                    {t.settings.accountSignOut}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
