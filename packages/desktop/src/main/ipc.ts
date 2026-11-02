// Canaux IPC (docs/DOCUMENTATION.md, annexe A.6). Chaque canal délègue au service.
// Les erreurs qui franchissent la frontière ne portent que des codes fixes, jamais de texte du document.

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { CHANNELS } from '../shared/api.js';
import type { DecideInput, SendInput } from '../shared/api.js';
import { logError } from './log.js';
import type { ChatService } from './service.js';

function asString(v: unknown): string {
  if (typeof v !== 'string') throw new Error('internal');
  return v;
}

export function registerIpc(service: ChatService, isTrusted: (sender: WebContents) => boolean): void {
  const handle = (channel: string, fn: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (!isTrusted(event.sender)) throw new Error('internal');
      try {
        return await fn(...args);
      } catch (e) {
        logError('ipc', 'handler_failed', e);
        const code = e instanceof Error && /^[a-z_]{3,40}$/.test(e.message) ? e.message : 'internal';
        // Pas de `cause` : elle pourrait contenir des données du document.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(code);
      }
    });
  };

  handle(CHANNELS.appInfo, () => service.info());
  handle(CHANNELS.appMeasure, () => service.measure());
  handle(CHANNELS.convList, () => service.list());
  handle(CHANNELS.convCreate, () => service.create());
  handle(CHANNELS.convGet, (id) => service.getView(asString(id)));
  handle(CHANNELS.convRename, (id, title) => service.rename(asString(id), asString(title)));
  handle(CHANNELS.convRemove, (id) => service.remove(asString(id)));
  handle(CHANNELS.convClear, (id) => service.clear(asString(id)));
  handle(CHANNELS.settingsUpdate, (input) => service.updateSettings(input as Parameters<ChatService['updateSettings']>[0]));
  handle(CHANNELS.filesImport, (id, name, bytes) => {
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('internal');
    const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array((bytes as ArrayBufferView).buffer);
    return service.importFile(asString(id), asString(name), data);
  });
  handle(CHANNELS.filesDiscard, (id, fileId) => service.discardFile(asString(id), asString(fileId)));
  handle(CHANNELS.detectRun, (id, text, commit) => service.analyze(asString(id), asString(text), commit === true));
  handle(CHANNELS.llmStatus, () => service.llmStatus());
  handle(CHANNELS.llmPropose, (id, text) => service.propose(asString(id), asString(text)));
  handle(CHANNELS.llmSkip, (id) => service.skipAnalysis(asString(id)));
  handle(CHANNELS.mentionsDecide, (input) => service.decide(input as DecideInput));
  handle(CHANNELS.chatPreview, (id, text, fileIds, pending) =>
    service.preview(asString(id), asString(text), (fileIds as unknown[]).map(asString), Number(pending) || 0),
  );
  handle(CHANNELS.chatSend, (input) => {
    const i = input as SendInput;
    return service.send({
      convId: asString(i.convId),
      userText: asString(i.userText),
      fileIds: Array.isArray(i.fileIds) ? i.fileIds.map(asString) : [],
      regenerate: i.regenerate === true,
    });
  });
  handle(CHANNELS.chatStop, (id) => service.stop(asString(id)));
}
