import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
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
import { UpdateController } from './update.ts'
import type { UpdateStatus } from './update-status.ts'
import { createDesktopLifecycle, type DesktopLifecycle } from './window-lifecycle.ts'
import { HIDDEN_LAUNCH_ARG, shouldStartHidden, type LoginItemController } from './autolaunch.ts'
import {
  createNotificationThrottle,
  RECOVERED_KEY,
  RECOVERED_NOTIFICATION,
  restartNotificationFor,
  type NotificationSink,
} from './notifications.ts'
import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  type CloseBehavior,
  type PreferencesStore,
} from './preferences.ts'

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
let updater: UpdateController | null = null
let quitReleased = false
let pendingDeepLink: string | null = null
let preferencesStore: PreferencesStore | null = null
let notificationsEnabled = DEFAULT_PREFERENCES.notificationsEnabled
let hiddenLaunch = false

/** Status reported while no updater exists (development or non-packaged runs). */
const UNSUPPORTED_STATUS: UpdateStatus = { phase: 'unsupported' }

/**
 * Resolve the branded app icon for window chrome, tray (Windows), and toasts.
 * Packaged builds read `desktop-resources/icon.png`; development uses `build/icon.png`.
 * @returns absolute path when the asset exists, else undefined.
 */
function resolveAppIcon(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'desktop-resources', 'icon.png')]
    : [join(app.getAppPath(), 'build', 'icon.png'), join(app.getAppPath(), 'resources', 'icon.png')]
  return candidates.find((candidate) => existsSync(candidate))
}

/** Load the tray glyph: macOS template PNG, Windows branded icon, empty fallback. */
function trayImage(): NativeImage {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const dir = app.isPackaged ? join(base, 'desktop-resources') : join(base, 'resources')
  const path = process.platform === 'darwin'
    ? join(dir, 'trayTemplate.png')
    : (resolveAppIcon() ?? join(dir, 'trayTemplate.png'))
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
  const appIcon = resolveAppIcon()
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
    ...(appIcon === undefined ? {} : { icon: appIcon }),
    webPreferences: {
      preload: join(app.getAppPath(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  win.once('ready-to-show', () => {
    if (!(lifecycle?.isQuitting ?? false) && !hiddenLaunch) win.show()
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

/** Snapshot returned to the Web GUI launch-at-login row. */
interface LaunchAtLoginState {
  enabled: boolean
  /** False in unpackaged Electron so the UI stays off and disabled. */
  available: boolean
}

function readLaunchAtLoginState(): LaunchAtLoginState {
  const enabled = preferencesStore?.read().launchAtLoginEnabled ?? DEFAULT_PREFERENCES.launchAtLoginEnabled
  return { enabled, available: app.isPackaged }
}

function writeLaunchAtLoginEnabled(enabled: boolean): LaunchAtLoginState {
  if (!app.isPackaged) return { enabled: false, available: false }
  createLoginItemController().setEnabled(enabled)
  const current = preferencesStore?.read() ?? { ...DEFAULT_PREFERENCES }
  preferencesStore?.write({ ...current, launchAtLoginEnabled: enabled })
  refreshTrayMenu()
  return { enabled, available: true }
}

/** Snapshot returned to the Web GUI system-notifications row. */
interface NotificationsPrefState {
  enabled: boolean
}

function readNotificationsState(): NotificationsPrefState {
  const enabled = preferencesStore?.read().notificationsEnabled ?? DEFAULT_PREFERENCES.notificationsEnabled
  return { enabled }
}

function writeNotificationsEnabled(enabled: boolean): NotificationsPrefState {
  notificationsEnabled = enabled
  const current = preferencesStore?.read() ?? { ...DEFAULT_PREFERENCES }
  preferencesStore?.write({ ...current, notificationsEnabled: enabled })
  refreshTrayMenu()
  return { enabled }
}

/** Snapshot returned to renderer close-behavior requests. */
interface CloseBehaviorState {
  behavior: CloseBehavior
}

function readCloseBehaviorState(): CloseBehaviorState {
  const behavior = preferencesStore?.read().closeBehavior ?? DEFAULT_PREFERENCES.closeBehavior
  return { behavior }
}

function writeCloseBehavior(behavior: unknown): CloseBehaviorState {
  const value: CloseBehavior = behavior === 'quit' ? 'quit' : 'tray'
  const current = preferencesStore?.read() ?? { ...DEFAULT_PREFERENCES }
  preferencesStore?.write({ ...current, closeBehavior: value })
  return { behavior: value }
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
  ipcMain.handle('dsh:launch-at-login-get', (): LaunchAtLoginState => readLaunchAtLoginState())
  ipcMain.handle('dsh:launch-at-login-set', (_event, enabled: unknown): LaunchAtLoginState => (
    writeLaunchAtLoginEnabled(enabled === true)
  ))
  ipcMain.handle('dsh:notifications-get', (): NotificationsPrefState => readNotificationsState())
  ipcMain.handle('dsh:notifications-set', (_event, enabled: unknown): NotificationsPrefState => (
    writeNotificationsEnabled(enabled === true)
  ))
  ipcMain.handle('dsh:close-behavior-get', (): CloseBehaviorState => readCloseBehaviorState())
  ipcMain.handle('dsh:close-behavior-set', (_event, behavior: unknown): CloseBehaviorState => (
    writeCloseBehavior(behavior)
  ))
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

/** Native notification backend backed by Electron's Notification API. */
function createElectronNotificationSink(): NotificationSink {
  return {
    show({ title, body }) {
      if (!Notification.isSupported()) return
      const icon = resolveAppIcon()
      new Notification({ title, body, ...(icon === undefined ? {} : { icon }) }).show()
    },
  }
}

/**
 * OS login-item access. Windows registers a Run key with the hidden-launch
 * argument; macOS login items (SMAppService) take no custom arguments, so
 * hidden launch is detected via `wasOpenedAtLogin` instead of argv there.
 */
function createLoginItemController(): LoginItemController {
  const isDarwin = process.platform === 'darwin'
  return {
    isEnabled() {
      if (isDarwin) return app.getLoginItemSettings().openAtLogin
      return app.getLoginItemSettings({ path: process.execPath, args: [HIDDEN_LAUNCH_ARG] }).openAtLogin
    },
    setEnabled(enabled) {
      if (isDarwin) {
        app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled })
      } else {
        app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [HIDDEN_LAUNCH_ARG] })
      }
    },
  }
}

/** Build the tray menu, querying live OS and preference state. */
function buildTrayMenu(): Menu {
  const launchAtLogin = readLaunchAtLoginState()
  const template: MenuItemConstructorOptions[] = [
    { label: 'Open Window', click: () => { void lifecycle?.showWindow() } },
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      enabled: launchAtLogin.available,
      checked: launchAtLogin.enabled,
      click: (menuItem) => {
        writeLaunchAtLoginEnabled(menuItem.checked)
      },
    },
    {
      label: 'Notifications',
      type: 'checkbox',
      checked: notificationsEnabled,
      click: (menuItem) => {
        writeNotificationsEnabled(menuItem.checked)
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { void requestAppQuit() } },
  ]
  return Menu.buildFromTemplate(template)
}

function refreshTrayMenu(): void {
  if (tray === null) return
  tray.setContextMenu(buildTrayMenu())
}

function createTray(): void {
  tray = new Tray(trayImage())
  tray.setToolTip(APP_NAME)
  refreshTrayMenu()
  tray.on('click', () => {
    refreshTrayMenu()
    void lifecycle?.showWindow()
  })
  tray.on('right-click', () => { refreshTrayMenu() })
}

function releaseAppQuit(): void {
  quitReleased = true
  tray?.destroy()
  tray = null
  // A downloaded update installs on this quit; otherwise quit normally. The
  // updater's quitAndInstall quits and runs the installer, so `app.quit()` is
  // deliberately not called again on that path.
  if (updater !== null && updater.hasDownloadedUpdate()) {
    updater.install()
    return
  }
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

/** Register the renderer-facing updater IPC surface once per process. */
function registerUpdaterIpc(): void {
  ipcMain.handle('dsh:updater:get-status', () => updater?.status ?? UNSUPPORTED_STATUS)
  ipcMain.handle('dsh:updater:check', () => { void updater?.check() })
  // "Install now" is a graceful quit with install-on-quit: it reuses the same
  // teardown as every other quit source rather than quitting out from under
  // the Host. Guarded so a stray call without a downloaded update is a no-op.
  ipcMain.handle('dsh:updater:install', () => {
    if (updater?.hasDownloadedUpdate() === true) void requestAppQuit()
  })
}

async function boot(): Promise<void> {
  app.setAppUserModelId('com.deepseek.dsh-desktop')
  preferencesStore = createPreferencesStore(join(app.getPath('userData'), 'preferences.json'))
  const prefs = preferencesStore.read()
  notificationsEnabled = prefs.notificationsEnabled
  if (app.isPackaged) {
    createLoginItemController().setEnabled(prefs.launchAtLoginEnabled)
  }
  hiddenLaunch = shouldStartHidden({
    argv: process.argv,
    openedAtLogin: app.getLoginItemSettings().wasOpenedAtLogin,
    platform: process.platform,
  })
  const appIcon = resolveAppIcon()
  if (process.platform === 'darwin' && appIcon !== undefined) {
    app.dock?.setIcon(appIcon)
  }
  registerWindowControlIpc()
  registerUpdaterIpc()
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const env = resolveDesktopEnv(resourceRoot)
  const sup = new HarnessSupervisor(env.launch.command, env.launch.args, {
    logFile: env.logFile,
    restartDelayMs: env.restartDelayMs,
    maxRestartDelayMs: env.maxRestartDelayMs,
    killTimeoutMs: env.killTimeoutMs,
  })
  supervisor = sup
  const notificationSink = createElectronNotificationSink()
  const notificationThrottle = createNotificationThrottle(5 * 60_000)
  let crashed = false
  sup.on('ready', () => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) loadWindow(mainWindow)
    if (crashed) {
      crashed = false
      if (notificationsEnabled && notificationThrottle.allow(RECOVERED_KEY, Date.now())) {
        notificationSink.show(RECOVERED_NOTIFICATION)
      }
    }
  })
  sup.on('restart', ({ attempt }) => {
    crashed = true
    // An unexpected exit killed the old origin; return to connecting until the
    // next child reports ready.
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CONNECTING_HTML)}`)
    }
    if (notificationsEnabled) {
      const rule = restartNotificationFor(attempt)
      if (rule !== undefined && notificationThrottle.allow(rule.key, Date.now())) {
        notificationSink.show(rule.notification)
      }
    }
  })
  sup.start()
  hardenSession()
  // A packaged build has an update feed (electron-builder's publish config);
  // development runs have no feed, so no updater exists and the renderer sees
  // `unsupported`. Download runs in the background; install waits for a quit.
  if (app.isPackaged) {
    updater = new UpdateController({ checkIntervalMs: env.updateCheckIntervalMs })
    updater.on('status', (status) => {
      const win = mainWindow
      if (win !== null && !win.isDestroyed()) win.webContents.send('dsh:updater:status', status)
    })
    updater.start()
  }
  lifecycle = createDesktopLifecycle({
    getWindow: () => mainWindow ?? undefined,
    createWindow: async () => createWindow(),
    disposeHost: async () => { await sup.stop() },
    quit: releaseAppQuit,
    reportError: (error) => { console.error('desktop shutdown failed:', error) },
    readCloseBehavior: () => preferencesStore?.read().closeBehavior ?? DEFAULT_PREFERENCES.closeBehavior,
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
