// Journal technique : jamais de texte en clair (docs/DEV_SETUP.md, §8).
// Seuls un nom de module, un code fixe et des nombres ou booléens sont acceptés.
// Le typage interdit de passer une chaîne libre ; une vérification à l'exécution le garantit aussi.

export type LogFields = Record<string, number | boolean>;

type Sink = (line: string) => void;

let sink: Sink = (line) => process.stderr.write(`${line}\n`);

/** Remplace la sortie (tests). */
export function setLogSink(next: Sink): void {
  sink = next;
}

const CODE_RE = /^[a-z][a-z0-9_]{0,40}$/;

export function log(module: string, code: string, fields: LogFields = {}): void {
  if (!CODE_RE.test(module) || !CODE_RE.test(code)) return;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!CODE_RE.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) parts.push(`${key}=${Math.round(value)}`);
    else if (typeof value === 'boolean') parts.push(`${key}=${value}`);
  }
  sink(`[${new Date().toISOString()}] ${module} ${code}${parts.length ? ` ${parts.join(' ')}` : ''}`);
}

/** Code d'erreur sans message : le message d'une exception peut contenir des données. */
export function logError(module: string, code: string, error: unknown): void {
  const name = error instanceof Error ? error.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'unknown';
  log(module, code, { name_len: name.length });
}
