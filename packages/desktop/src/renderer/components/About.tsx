import { X } from 'lucide-react';
import logoDark from '../assets/logo-dark.svg';
import logo from '../assets/logo.svg';
import { t } from '../messages.js';

export function About({ dark, onClose }: { dark: boolean; onClose(): void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal about" role="dialog" aria-modal="true" aria-label={t.about.title} data-testid="about">
        <header className="modal-head">
          <h2>{t.about.title}</h2>
          <button type="button" className="icon-btn" aria-label={t.settings.close} onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="modal-body about-body">
          <img src={dark ? logoDark : logo} alt={t.app.name} width={300} />
          <p>{t.about.version}</p>
          <p className="text-2">{t.about.note}</p>
        </div>
      </div>
    </div>
  );
}
