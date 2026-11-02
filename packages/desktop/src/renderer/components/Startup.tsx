import { Loader2 } from 'lucide-react';
import logoDark from '../assets/logo-dark.svg';
import logo from '../assets/logo.svg';
import { t } from '../messages.js';

/** Premier lancement : préparation de l'analyse approfondie, avec sortie vers l'analyse de base. */
export function Startup({ dark, onContinueBasic }: { dark: boolean; onContinueBasic(): void }) {
  return (
    <div className="startup" role="dialog" aria-modal="true" aria-label={t.startup.preparing} data-testid="startup">
      <img src={dark ? logoDark : logo} alt={t.app.name} width={320} />
      <div className="startup-lines" aria-hidden>
        <span className="line line-grey" />
        <span className="line line-green" />
        <span className="line line-grey" />
      </div>
      <h1>{t.startup.preparing}</h1>
      <p className="text-2" role="status">
        <Loader2 size={16} className="spin" aria-hidden /> {t.startup.integrity}
      </p>
      <button type="button" className="btn btn-secondary" onClick={onContinueBasic} data-testid="startup-basic">
        {t.startup.continueBasic}
      </button>
      <p className="small text-2 startup-help">{t.startup.continueBasicHelp}</p>
    </div>
  );
}
