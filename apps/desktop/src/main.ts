import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { HarnessSupervisor } from './harness.ts'
import { resolveDesktopEnv } from './env.ts'
import { createDesktopLifecycle, type DesktopLifecycle } from './window-lifecycle.ts'

const APP_NAME = 'DeepSeek Harness'

/** Deep-link scheme the shell forwards to the renderer untouched. */
const DEEP_LINK_PREFIX = 'dsh://'

/** Minimal connecting page shown before the harness reports readiness. */
const CONNECTING_HTML = `<!doctype html>
<meta charset="utf-8">
<title>DeepSeek Harness</title>
<style>
  body { margin: 0; display: grid; place-items: center; height: 100vh;
         font: 14px/1.5 system-ui, -apple-system, sans-serif; color: #9aa0a6;
         background: #1f2328; -webkit-app-region: drag; }
</style>
<p>正在启动 DeepSeek Harness…</p>`


/**
 * Frameless Windows caption + minimal drag chrome.
 * A wide mid-header drag overlay previously swallowed clicks on "子代理"
 * and the Files/Changes tabs. Keep only a thin top edge + left brand strip,
 * paint visible caption buttons, and show grab cursor on drag regions.
 */
const WINDOW_DRAG_CSS = `
body { -webkit-app-region: no-drag; }
/* Hairline along the very top — safe to drag without covering controls. */
#dsh-desktop-drag-edge {
  position: fixed;
  top: 0;
  left: 0;
  right: 138px;
  height: 6px;
  z-index: 2147483646;
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
  cursor: grab;
}
#dsh-desktop-drag-edge:active { cursor: grabbing; }
/* Left brand gutter only — does not cover center header or right panel tabs. */
#dsh-desktop-drag {
  position: fixed;
  top: 6px;
  left: 0;
  width: 168px;
  height: 34px;
  z-index: 2147483645;
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
  cursor: grab;
}
#dsh-desktop-drag:active { cursor: grabbing; }
[data-skin-chrome="titlebar"] { -webkit-app-region: no-drag; }
[data-skin-chrome="titlebar"] > span:not([class*="TitlebarBtn"]):not([data-dsh-caption]) {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
  cursor: grab;
}
[data-skin-chrome="titlebar"] [class*="TitlebarBtn"],
[data-skin-chrome="titlebar"] [data-dsh-caption],
#dsh-desktop-caption,
#dsh-desktop-caption * {
  -webkit-app-region: no-drag !important;
  pointer-events: auto !important;
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
}
#dsh-desktop-caption {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2147483647;
  height: 40px;
  display: flex;
  align-items: stretch;
  margin: 0;
  padding: 0;
  gap: 0;
  box-sizing: border-box;
  -webkit-app-region: no-drag;
}
#dsh-desktop-caption button {
  width: 46px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #3c4043;
  font: 16px/40px "Segoe UI Symbol", "Segoe UI", sans-serif;
  cursor: pointer;
  -webkit-app-region: no-drag !important;
}
#dsh-desktop-caption button:hover { background: #00000014; }
#dsh-desktop-caption button[data-dsh-caption="close"]:hover {
  background: #e81123;
  color: #fff;
}
#dsh-desktop-caption[data-mode="overlay"] button {
  color: transparent;
  background: transparent;
  font-size: 0;
}
#dsh-desktop-caption[data-mode="overlay"] button:hover {
  background: #ffffff33;
  color: transparent;
}
#dsh-desktop-caption[data-mode="overlay"] button[data-dsh-caption="close"]:hover {
  background: #e81123;
}
button, a, input, textarea, select, [role="button"], [role="textbox"],
[role="menuitem"], [contenteditable="true"], canvas, iframe, video {
  -webkit-app-region: no-drag !important;
}
`

/** Inject drag strip + caption buttons (works with or without a skin titlebar). */
const WIRE_SKIN_CAPTION_JS = `(() => {
  const api = window.dshDesktop;
  if (!api || typeof api.minimize !== 'function') return;
  if (document.getElementById('dsh-desktop-chrome')) return;

  const root = document.createElement('div');
  root.id = 'dsh-desktop-chrome';

  const edge = document.createElement('div');
  edge.id = 'dsh-desktop-drag-edge';
  edge.setAttribute('aria-hidden', 'true');
  edge.title = '拖动窗口';

  const drag = document.createElement('div');
  drag.id = 'dsh-desktop-drag';
  drag.setAttribute('aria-hidden', 'true');
  drag.title = '拖动窗口';

  const bar = document.createElement('div');
  bar.id = 'dsh-desktop-caption';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Window controls');

  const syncMode = () => {
    bar.dataset.mode = document.querySelector('[data-skin-chrome="titlebar"]') ? 'overlay' : 'chrome';
  };

  const actions = [
    ['min', 'Minimize', '–', () => api.minimize()],
    ['max', 'Maximize', '□', () => api.maximize()],
    ['close', 'Close', '×', () => api.close()],
  ];
  for (const [id, label, glyph, run] of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.dshCaption = id;
    btn.setAttribute('aria-label', label);
    btn.textContent = glyph;
    btn.style.webkitAppRegion = 'no-drag';
    const fire = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void run();
    };
    btn.addEventListener('pointerdown', fire, true);
    btn.addEventListener('mousedown', fire, true);
    btn.addEventListener('click', fire, true);
    btn.addEventListener('dblclick', fire, true);
    bar.appendChild(btn);
  }

  root.append(edge, drag, bar);
  const mount = () => {
    if (!document.body) return false;
    document.body.appendChild(root);
    syncMode();
    new MutationObserver(syncMode).observe(document.documentElement, { childList: true, subtree: true });
    return true;
  };
  if (!mount()) {
    document.addEventListener('DOMContentLoaded', () => { mount(); }, { once: true });
  }
})()`

let mainWindow: BrowserWindow | null = null
let supervisor: HarnessSupervisor | null = null
let tray: Tray | null = null
let lifecycle: DesktopLifecycle | null = null
let quitReleased = false
let pendingDeepLink: string | null = null

/**
 * The square DeepSeek icon shipped under `build/` (electron-builder's build
 * resource dir). Packaged builds already get their icon from electron-builder
 * (the `.icns`/`.ico` it derives), so this is only present in development
 * where `electron .` would otherwise fall back to the stock Electron glyph.
 * @returns the icon path when the repo's `build/icon.png` exists, else undefined.
 */
function resolveDevIcon(): string | undefined {
  const candidate = join(app.getAppPath(), 'build', 'icon.png')
  return existsSync(candidate) ? candidate : undefined
}

/** Load the app-local tray template, with an empty fallback for incomplete staging. */
function trayImage(): NativeImage {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const dir = app.isPackaged ? join(base, 'desktop-resources') : join(base, 'resources')
  const path = join(dir, 'trayTemplate.png')
  const image = existsSync(path) ? nativeImage.createFromPath(path) : nativeImage.createEmpty()
  if (process.platform === 'darwin') image.setTemplateImage(true)
  return image
}

function isExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasOrigin(raw: string, expected: string): boolean {
  try {
    return new URL(raw).origin === expected
  } catch {
    return false
  }
}

/** Install navigation and permission policy before the first renderer loads. */
function hardenSession(): void {
  const desktopSession = session.defaultSession
  const allow = new Set(['clipboard-read', 'clipboard-sanitized-write'])
  desktopSession.setPermissionCheckHandler((_wc, permission) => allow.has(permission))
  desktopSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allow.has(permission))
  })
}

function createWindow(): BrowserWindow {
  const devIcon = resolveDevIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    // Frameless on Windows so skins are not covered by native caption buttons.
    // macOS still uses hidden-inset traffic lights; Windows gets WINDOW_DRAG_CSS.
    frame: process.platform !== 'win32',
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 12 },
      vibrancy: 'sidebar',
      visualEffectState: 'followWindow',
      transparent: true,
      backgroundColor: '#00000000',
    } : process.platform === 'win32' ? {
      backgroundMaterial: 'acrylic',
      hasShadow: true,
      roundedCorners: true,
      thickFrame: true,
    } : {
      transparent: true,
      backgroundColor: '#00000000',
    }),
    title: APP_NAME,
    ...(devIcon === undefined ? {} : { icon: devIcon }),
    webPreferences: {
      preload: join(app.getAppPath(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  win.once('ready-to-show', () => {
    if (!(lifecycle?.isQuitting ?? false)) win.show()
  })
  // An ordinary close hides to the tray; the Host stays alive until an
  // explicit quit disposes it (see window-lifecycle.ts).
  win.on('close', (event) => { lifecycle?.onWindowClose(event) })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.webContents.on('will-navigate', (event, url) => {
    const origin = supervisor?.url
    if (origin !== null && origin !== undefined && hasOrigin(url, origin)) return
    event.preventDefault()
    if (isExternalUrl(url)) void shell.openExternal(url)
  })
  // The shell opens no second windows; hand external navigation to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-finish-load', () => {
    if (process.platform === 'win32' && !win.isDestroyed()) {
      void win.webContents.insertCSS(WINDOW_DRAG_CSS)
      void win.webContents.executeJavaScript(WIRE_SKIN_CAPTION_JS, true)
    }
    if (pendingDeepLink !== null && !win.isDestroyed()) {
      win.webContents.send('dsh:deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })
  return win
}

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function registerWindowControlIpc(): void {
  ipcMain.handle('dsh:window-minimize', (event) => {
    const win = windowFromEvent(event)
    if (win === null || win.isDestroyed()) return
    // Acrylic / frameless Windows sometimes ignores a synchronous minimize.
    win.setMinimizable(true)
    if (win.isMaximized()) win.unmaximize()
    setImmediate(() => {
      if (!win.isDestroyed()) win.minimize()
    })
  })
  ipcMain.handle('dsh:window-maximize', (event) => {
    const win = windowFromEvent(event)
    if (win === null || win.isDestroyed()) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('dsh:window-close', (event) => {
    windowFromEvent(event)?.close()
  })
}

/** Load the harness origin, or the connecting page when it is not ready yet. */
function loadWindow(win: BrowserWindow): void {
  const url = supervisor?.url
  if (url === null || url === undefined) {
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CONNECTING_HTML)}`)
  } else {
    // Mark the renderer so the Web GUI can reserve title-bar space under
    // frameless window controls (macOS traffic lights sit over the sidebar).
    const rendererUrl = new URL(url)
    rendererUrl.searchParams.set('dsh-desktop-platform', process.platform)
    void win.loadURL(rendererUrl.href)
  }
}

function deliverDeepLink(url: string): void {
  if (!url.startsWith(DEEP_LINK_PREFIX)) return
  pendingDeepLink = url
  const win = mainWindow
  if (win !== null && !win.isDestroyed() && !win.webContents.isLoading()) {
    win.webContents.send('dsh:deep-link', url)
    pendingDeepLink = null
  }
}

function createTray(): void {
  tray = new Tray(trayImage())
  tray.setToolTip(APP_NAME)
  const template: MenuItemConstructorOptions[] = [
    { label: 'Open Window', click: () => { void lifecycle?.showWindow() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { void requestAppQuit() } },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.on('click', () => { void lifecycle?.showWindow() })
}

function releaseAppQuit(): void {
  quitReleased = true
  tray?.destroy()
  tray = null
  app.quit()
}

/** Join explicit quit requests even while the Host is still starting. */
function requestAppQuit(): Promise<void> {
  if (lifecycle !== null) return lifecycle.requestQuit()
  return (supervisor?.stop() ?? Promise.resolve()).catch((error: unknown) => {
    console.error('desktop shutdown failed:', error)
  }).then(() => {
    releaseAppQuit()
  })
}

async function boot(): Promise<void> {
  // macOS dock shows the Electron glyph until the app is packaged; mirror the
  // build icon during development only (the packaged bundle's `.icns` is set
  // by electron-builder and needs no runtime override).
  if (process.platform === 'darwin') {
    const devIcon = resolveDevIcon()
    if (devIcon !== undefined) app.dock?.setIcon(devIcon)
  }
  registerWindowControlIpc()
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const env = resolveDesktopEnv(resourceRoot)
  const sup = new HarnessSupervisor(env.launch.command, env.launch.args, {
    logFile: env.logFile,
    restartDelayMs: env.restartDelayMs,
    maxRestartDelayMs: env.maxRestartDelayMs,
    killTimeoutMs: env.killTimeoutMs,
  })
  supervisor = sup
  sup.on('ready', () => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) loadWindow(mainWindow)
  })
  sup.on('restart', () => {
    // An unexpected exit killed the old origin; return to connecting until the
    // next child reports ready.
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CONNECTING_HTML)}`)
    }
  })
  sup.start()
  hardenSession()
  lifecycle = createDesktopLifecycle({
    getWindow: () => mainWindow ?? undefined,
    createWindow: async () => createWindow(),
    disposeHost: async () => { await sup.stop() },
    quit: releaseAppQuit,
    reportError: (error) => { console.error('desktop shutdown failed:', error) },
  })
  createTray()
  mainWindow = createWindow()
  loadWindow(mainWindow)
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    void lifecycle?.showWindow()
    const link = argv.find(arg => arg.startsWith(DEEP_LINK_PREFIX))
    if (link !== undefined) deliverDeepLink(link)
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  deliverDeepLink(url)
})

app.on('activate', () => {
  void lifecycle?.showWindow()
})

app.on('window-all-closed', () => {
  // The tray and Host own application lifetime on every platform; the window
  // is hidden rather than destroyed on close.
})

app.on('before-quit', (event) => {
  if (quitReleased) return
  event.preventDefault()
  void requestAppQuit()
})

void app.whenReady().then(boot).catch((error: unknown) => {
  console.error('desktop startup failed:', error)
  if (quitReleased) return
  void dialog.showMessageBox({
    type: 'error',
    title: `${APP_NAME} failed to start`,
    message: error instanceof Error ? error.message : String(error),
  }).finally(() => {
    void requestAppQuit()
  })
})
