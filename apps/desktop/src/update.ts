/**
 * Electron binding for the auto-updater: wraps `electron-updater`, folds its
 * events through the pure `update-status` reducer, and re-checks on an
 * interval. Download happens in the background (`autoDownload`); installation
 * is explicit — the shell calls {@link UpdateController.install} from its quit
 * path once a download has completed, so an update never interrupts a running
 * session.
 */
import { EventEmitter } from 'node:events'
// electron-updater is CommonJS and exposes `autoUpdater` through a lazy getter,
// which Node's ESM named-export detection cannot see (a bare `import { autoUpdater }`
// throws at runtime). Import the CJS namespace and read the property instead.
import electronUpdater from 'electron-updater'
import {
  createUpdateStatusStore,
  type UpdateEvent,
  type UpdateStatus,
  type UpdateStatusStore,
} from './update-status.ts'

const { autoUpdater } = electronUpdater

/** Tunables resolved from the desktop environment (`env.ts`). */
export interface UpdateControllerOptions {
  /** Interval between background re-checks, in milliseconds. */
  readonly checkIntervalMs: number
}

/** Events emitted by {@link UpdateController}. */
export interface UpdateControllerEvents {
  /** The folded status changed; carries the new status. */
  status: [status: UpdateStatus]
}

/** Map one electron-updater event into a reducer input. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Own the app's auto-update lifecycle: fold electron-updater events into one
 * status observable, background-check on an interval, and install on demand.
 * One controller owns one feed connection; `stop` detaches every listener.
 */
export class UpdateController extends EventEmitter<UpdateControllerEvents> {
  private readonly store: UpdateStatusStore
  private readonly options: UpdateControllerOptions
  private timer: NodeJS.Timeout | null = null

  constructor(options: UpdateControllerOptions) {
    super()
    this.options = options
    this.store = createUpdateStatusStore()
  }

  /** The current folded status. */
  get status(): UpdateStatus {
    return this.store.getSnapshot()
  }

  /** Subscribe to status changes; returns the unsubscribe function. */
  subscribe(fn: () => void): () => void {
    return this.store.subscribe(fn)
  }

  /** Whether a new version is downloaded and waiting to install. */
  hasDownloadedUpdate(): boolean {
    return this.status.phase === 'downloaded'
  }

  /** Begin background checking: bind events, check once, then re-check on an interval. */
  start(): void {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.on('checking-for-update', () => { this.dispatch({ type: 'checking' }) })
    autoUpdater.on('update-available', (info) => { this.dispatch({ type: 'available', version: info.version }) })
    autoUpdater.on('download-progress', (progress) => {
      this.dispatch({ type: 'download-progress', percent: progress.percent })
    })
    autoUpdater.on('update-downloaded', (info) => { this.dispatch({ type: 'downloaded', version: info.version }) })
    autoUpdater.on('update-not-available', () => { this.dispatch({ type: 'not-available' }) })
    autoUpdater.on('error', (error) => { this.dispatch({ type: 'error', message: messageOf(error) }) })
    void this.check()
    this.timer = setInterval(() => { void this.check() }, this.options.checkIntervalMs)
  }

  /**
   * Run one feed check. The rejection is folded into the status store here;
   * electron-updater also emits `error` for download-phase failures, which the
   * listener above handles.
   */
  async check(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.dispatch({ type: 'error', message: messageOf(error) })
    }
  }

  /** Quit and install the downloaded update; a no-op unless one is downloaded. */
  install(): void {
    if (!this.hasDownloadedUpdate()) return
    autoUpdater.quitAndInstall()
  }

  /** Detach listeners and the re-check timer. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    autoUpdater.removeAllListeners()
  }

  private dispatch(event: UpdateEvent): void {
    this.store.dispatch(event)
    this.emit('status', this.status)
  }
}
