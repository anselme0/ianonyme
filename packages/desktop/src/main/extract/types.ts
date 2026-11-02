import type { ErrorCode, FileWarning } from '../../shared/api.js';

export interface Extracted {
  text: string;
  warnings: FileWarning[];
}

export class ExtractError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = 'ExtractError';
  }
}
