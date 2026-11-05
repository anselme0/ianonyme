// Processus principal d'Electron : fenêtre, sécurité, branchement du service.
// Réglages de sécurité : docs/DEV_SETUP.md, §7.

import { app, BrowserWindow, session } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './config.js';
import { registerIpc } from './ipc.js';
import { createLocalLlm, probeNativeRuntime } from './localllm.js';
import { log } from './log.js';
import { createProviders } from './providers/registry.js';
import { ChatService } from './service.js';
import { CHANNELS } from '../shared/api.js';

const DEV_URL = process.env.ELECTRON_RENDERER_URL;

function repoRoot(): string {
  return resolve(app.getAppPath(), '..', '..');
}

function configPath(): string | undefined {
  const candidates = [
    process.env.IANONYME_CONFIG,
    join(app.getPath('userData'), 'local.config.json'),
    join(repoRoot(), 'config', 'local.config.json'),
    join(process.resourcesPath ?? '', 'config', 'local.config.json'),
  ];
  return candidates.find((p): p is string => typeof p === 'string' && p.length > 0 && existsSync(p));
}

function measurePath(): string | undefined {
  const candidates = [join(process.resourcesPath ?? '', 'measure.json'), join(repoRoot(), 'reports', 'measure.json')];
  return candidates.find((p) => existsSync(p));
}

function csp(): string {
  // Pas de script ni de ressource distante. En développement seulement, le serveur Vite a besoin de ses évènements.
  return DEV_URL
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*"
    : "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
}

let mainWindow: BrowserWindow | null = null;

/**
 * Pendant les tests de bout en bout, la fenêtre s'ouvre hors écran, sans prendre le focus ni apparaître dans la barre
 * des tâches : on peut continuer à travailler. `IANONYME_E2E_VISIBLE=1` la montre normalement (pour déboguer).
 */
const quiet = Boolean(process.env.IANONYME_E2E) && !process.env.IANONYME_E2E_VISIBLE;

function createWindow(): BrowserWindow {
  const icon = [join(process.resourcesPath ?? '', 'icon.png'), join(app.getAppPath(), 'resources', 'icon.png')].find(existsSync);
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    ...(quiet ? { x: -10000, y: -10000, focusable: false, skipTaskbar: true } : {}),
    backgroundColor: '#14202f',
    title: 'IAnonyme',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => (quiet ? win.showInactive() : win.show()));
  // Aucune navigation ni fenêtre externe depuis l'application.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return win;
}

const lock = app.requestSingleInstanceLock();
if (!lock && !process.env.IANONYME_E2E) app.quit();

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp()] } });
  });

  const config = loadConfig(configPath());
  const llm = createLocalLlm(config, join(app.getPath('userData'), 'models'));
  const providers = createProviders(config);
  const send = <T>(channel: string, payload: T): void => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };
  const service = new ChatService({
    config,
    providers,
    llm,
    measurePath: measurePath(),
    events: {
      chunk: (e) => send(CHANNELS.chatChunk, e),
      done: (e) => send(CHANNELS.chatDone, e),
      error: (e) => send(CHANNELS.chatError, e),
    },
  });
  mainWindow = createWindow();
  registerIpc(service, (sender) => mainWindow !== null && sender === mainWindow.webContents);
  llm.warmUp();
  log('main', 'ready', { providers: providers.size, packaged: app.isPackaged });
  if (process.env.IANONYME_PROBE) void probeNativeRuntime().then((ok) => {
      log('localllm', 'native_probe', { ok });
      (globalThis as { ianonymeProbe?: boolean }).ianonymeProbe = ok;
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  // Les correspondances sont en mémoire : elles disparaissent avec le processus.
  app.quit();
});
