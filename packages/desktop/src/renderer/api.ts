import type { IanonymeApi } from '../shared/api.js';

/** Passerelle vers le processus principal (exposée par le script de préchargement). */
export const api: IanonymeApi = window.ianonyme;
