/**
 * Narrow typing for the desktop preload bridge (`window.dshDesktop.updates`),
 * exposed only by the Electron shell. In a plain browser the global is absent,
 * so the plugin registers nothing and the footer action renders nothing.
 */

/** Phases mirrored from `apps/desktop/src/update-status.ts` (the wire format). */
export type UpdateStatus =
  /** No update channel: a development or otherwise non-packaged run. */
  | { phase: 'unsupported' }
  /** Nothing checked yet. */
  | { phase: 'idle' }
  /** Contacting the update feed. */
  | { phase: 'checking' }
  /** A newer version exists and is about to download. */
  | { phase: 'available'; version: string }
  /** Downloading; `percent` is a 0..100 integer. */
  | { phase: 'downloading'; version: string; percent: number }
  /** Downloaded and waiting for the next quit to install. */
  | { phase: 'downloaded'; version: string }
  /** The installed version is current. */
  | { phase: 'up-to-date' }
  /** The last check or download failed. */
  | { phase: 'error'; message: string }

/** The update methods the preload exposes. */
export interface DesktopUpdateBridge {
  /** Read the current status. */
  getStatus(): Promise<UpdateStatus>
  /** Subscribe to status pushes; returns the unsubscribe function. */
  onStatus(callback: (status: UpdateStatus) => void): () => void
  /** Request a manual feed check. */
  check(): Promise<void>
  /** Quit and install the downloaded update. */
  install(): Promise<void>
}

/** The `window.dshDesktop` surface the preload builds. */
interface DesktopGlobal {
  readonly platform?: string
  readonly electron?: string
  readonly updates?: DesktopUpdateBridge
  readonly onDeepLink?: (callback: (url: string) => void) => () => void
}

declare global {
  interface Window {
    dshDesktop?: DesktopGlobal
  }
}

/**
 * Read the update bridge, or `null` when not running under the desktop shell.
 * @returns the bridge when present, else null.
 */
export function readUpdateBridge(): DesktopUpdateBridge | null {
  return typeof window === 'undefined' ? null : window.dshDesktop?.updates ?? null
}
