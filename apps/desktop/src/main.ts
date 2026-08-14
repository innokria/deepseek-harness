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
 * Frameless Windows: only the skin titlebar drags. Body-wide drag swallowed
 * clicks on decorative caption glyphs (– □ ×) and turned them into maximize.
 */
const WINDOW_DRAG_CSS = `
body { -webkit-app-region: no-drag; }
[data-skin-chrome="titlebar"] { -webkit-app-region: drag; }
/* Skin caption glyphs are <span class="…TitlebarBtn">, not <button>. */
[data-skin-chrome="titlebar"] [class*="TitlebarBtn"],
[data-skin-chrome="titlebar"] [data-dsh-caption] {
  -webkit-app-region: no-drag !important;
  cursor: pointer;
  pointer-events: auto !important;
}
button, a, input, textarea, select, [role="button"], [role="textbox"],
[role="menuitem"], [contenteditable="true"], canvas, iframe, video {
  -webkit-app-region: no-drag;
}
`

/** Wire skin titlebar – / □ / × to the desktop shell after the skin mounts. */
const WIRE_SKIN_CAPTION_JS = `(() => {
  const api = window.dshDesktop;
  if (!api || typeof api.minimize !== 'function') return;
  const actionFor = (el) => {
    const marked = el.getAttribute('data-dsh-caption');
    if (marked === 'min' || marked === 'max' || marked === 'close') return marked;
    const text = (el.textContent || '').trim();
    if (text === '–' || text === '-' || text === '−' || text === '—') return 'min';
    if (text === '□' || text === '❐' || text === '▢' || text === '🗖') return 'max';
    if (text === '×' || text === '✕' || text === '✖' || text === 'X' || text === 'x') return 'close';
    return null;
  };
  const run = (action) => {
    if (action === 'min') void api.minimize();
    else if (action === 'max') void api.maximize();
    else if (action === 'close') void api.close();
  };
  const wire = (titlebar) => {
    if (!titlebar || titlebar.dataset.dshCaptionWired === '1') return;
    let buttons = Array.from(titlebar.querySelectorAll('[class*="TitlebarBtn"]'));
    if (buttons.length < 3) {
      buttons = Array.from(titlebar.querySelectorAll(':scope > span')).slice(-3);
    }
    if (buttons.length < 3) return;
    const trio = buttons.slice(-3);
    const actions = ['min', 'max', 'close'];
    trio.forEach((btn, index) => {
      const action = actionFor(btn) || actions[index];
      btn.setAttribute('data-dsh-caption', action);
      btn.style.webkitAppRegion = 'no-drag';
      const fire = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        run(action);
      };
      // pointerdown beats Electron drag-region click swallowing on caption spans.
      btn.addEventListener('pointerdown', fire, true);
      btn.addEventListener('click', fire, true);
    });
    titlebar.dataset.dshCaptionWired = '1';
  };
  const scan = () => {
    document.querySelectorAll('[data-skin-chrome="titlebar"]').forEach(wire);
  };
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
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
  desktopSession.setPermissionCheckHandler(() => false)
  desktopSession.setPermissionRequestHandler((_webContents, _permission, callback) => { callback(false) })
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
