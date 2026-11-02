// Script de préchargement : surface minimale et typée exposée à l'interface (docs/DEV_SETUP.md, §7).
// Aucun accès générique au système de fichiers, au réseau ou à Node.

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../shared/api.js';
import type {
  ChatChunkEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  IanonymeApi,
} from '../shared/api.js';

const call = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

function subscribe<T>(channel: string, cb: (e: T) => void): () => void {
  const listener = (_: unknown, payload: T): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: IanonymeApi = {
  app: {
    info: () => call(CHANNELS.appInfo),
    measure: () => call(CHANNELS.appMeasure),
  },
  conversations: {
    list: () => call(CHANNELS.convList),
    create: () => call(CHANNELS.convCreate),
    get: (convId) => call(CHANNELS.convGet, convId),
    rename: (convId, title) => call(CHANNELS.convRename, convId, title),
    remove: (convId) => call(CHANNELS.convRemove, convId),
    clear: (convId) => call(CHANNELS.convClear, convId),
  },
  settings: { update: (input) => call(CHANNELS.settingsUpdate, input) },
  files: {
    import: (convId, name, bytes) => call(CHANNELS.filesImport, convId, name, bytes),
    discard: (convId, fileId) => call(CHANNELS.filesDiscard, convId, fileId),
  },
  detect: { run: (convId, text, commit) => call(CHANNELS.detectRun, convId, text, commit === true) },
  llm: {
    status: () => call(CHANNELS.llmStatus),
    propose: (convId, text) => call(CHANNELS.llmPropose, convId, text),
    skip: (convId) => call(CHANNELS.llmSkip, convId),
  },
  mentions: { decide: (input) => call(CHANNELS.mentionsDecide, input) },
  chat: {
    preview: (convId, userText, fileIds, pending) =>
      call(CHANNELS.chatPreview, convId, userText, fileIds, pending),
    send: (input) => call(CHANNELS.chatSend, input),
    stop: (convId) => call(CHANNELS.chatStop, convId),
  },
  on: {
    chunk: (cb) => subscribe<ChatChunkEvent>(CHANNELS.chatChunk, cb),
    done: (cb) => subscribe<ChatDoneEvent>(CHANNELS.chatDone, cb),
    error: (cb) => subscribe<ChatErrorEvent>(CHANNELS.chatError, cb),
  },
};

contextBridge.exposeInMainWorld('ianonyme', api);
