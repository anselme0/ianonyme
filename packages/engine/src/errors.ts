/** Erreur du moteur. Le message est un code fixe : il ne contient jamais de valeur du texte. */
export class EngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'EngineError';
  }
}
