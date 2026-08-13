import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { HarnessSupervisor } from './harness.ts'
import { resolveDesktopEnv } from './env.ts'

/** Deep-link scheme the shell forwards to the renderer untouched. */
const DEEP_LINK_PREFIX = 'dsh://'

/** Minimal connecting page shown before the harness reports readiness. */
const CONNECTING_HTML = `<!doctype html>
<meta charset="utf-8">
<title>DeepSeek Harness</title>
<style>
  body { margin: 0; display: grid; place-items: center; height: 100vh;
         font: 14px/1.5 system-ui, -apple-system, sans-serif; color: #9aa0a6;
         background: #1f2328; }
</style>
<p>正在启动 DeepSeek Harness…</p>`

let mainWindow: BrowserWindow | null = null
let supervisor: HarnessSupervisor | null = null
let supervisorStopped = false
let quitting = false
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

function createWindow(): BrowserWindow {
  const devIcon = resolveDevIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'DeepSeek Harness',
    ...(devIcon === undefined ? {} : { icon: devIcon }),
    webPreferences: {
      preload: join(app.getAppPath(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => {
    if (!quitting) win.show()
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  // The shell opens no second windows; hand external navigation to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-finish-load', () => {
    if (pendingDeepLink !== null && !win.isDestroyed()) {
      win.webContents.send('dsh:deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })
  return win
}

/** Load the harness origin, or the connecting page when it is not ready yet. */
function loadWindow(win: BrowserWindow): void {
  const url = supervisor?.url
  if (url === null || url === undefined) {
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CONNECTING_HTML)}`)
  } else {
    void win.loadURL(url)
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

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    const link = argv.find(arg => arg.startsWith(DEEP_LINK_PREFIX))
    if (link !== undefined) deliverDeepLink(link)
  })
}

void app.whenReady().then(() => {
  // macOS dock shows the Electron glyph until the app is packaged; mirror the
  // build icon during development only (the packaged bundle's `.icns` is set
  // by electron-builder and needs no runtime override).
  if (process.platform === 'darwin') {
    const devIcon = resolveDevIcon()
    if (devIcon !== undefined) app.dock?.setIcon(devIcon)
  }
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
  mainWindow = createWindow()
  loadWindow(mainWindow)
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  deliverDeepLink(url)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
    loadWindow(mainWindow)
  }
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', (event) => {
  if (supervisor !== null && !supervisorStopped) {
    event.preventDefault()
    void supervisor.stop().finally(() => {
      supervisorStopped = true
      app.quit()
    })
  }
})
