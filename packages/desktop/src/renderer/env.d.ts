/// <reference types="vite/client" />
import type { IanonymeApi } from '../shared/api.js';

declare global {
  interface Window {
    ianonyme: IanonymeApi;
  }
}
