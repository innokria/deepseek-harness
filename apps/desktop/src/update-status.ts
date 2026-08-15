/**
 * Pure auto-update status reducer, independent from Electron so the state
 * machine and its store are unit-testable in a plain Node environment. The
 * Electron binding in `update.ts` feeds electron-updater events through this
 * reducer and the renderer reads the resulting status through the preload
 * bridge.
 */

/** The phases a desktop auto-update run can be in. */
export type UpdateStatus =
  /** No update channel: a development or otherwise non-packaged run. */
  | { phase: 'unsupported' }
  /** Nothing checked yet; the initial state of a packaged app. */
  | { phase: 'idle' }
  /** Contacting the update feed. */
  | { phase: 'checking' }
  /** A newer version exists and is about to download. */
  | { phase: 'available'; version: string }
  /** Downloading the new version; `percent` is a clamped 0..100 integer. */
  | { phase: 'downloading'; version: string; percent: number }
  /** The new version is downloaded and waits for the next quit to install. */
  | { phase: 'downloaded'; version: string }
  /** The feed reports the installed version as current. */
  | { phase: 'up-to-date' }
  /** The last check or download failed. */
  | { phase: 'error'; message: string }

/** One event fed into the reducer; payloads mirror electron-updater's. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'download-progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/** Guard for the reducer's closed union; only the impossible event reaches it. */
function assertNever(event: never): never {
  throw new Error(`unreachable update event: ${JSON.stringify(event)}`)
}

/** Clamp an electron-updater percentage into a safe 0..100 integer. */
function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(100, Math.round(percent)))
}

/**
 * The version carried by the current state, when one was already learned.
 * `download-progress` carries no version, so the reducer re-attaches the
 * version from the preceding `available` or `downloading` state.
 * @param current - the state the event transitions from.
 * @returns the known version string, or `''` when none is known yet.
 */
function versionFrom(current: UpdateStatus): string {
  return current.phase === 'available' || current.phase === 'downloading'
    ? current.version
    : ''
}

/**
 * Reduce one updater event into the next status.
 * @param current - the current status.
 * @param event - the event to fold in.
 * @returns the successor status.
 */
export function reduceUpdateStatus(current: UpdateStatus, event: UpdateEvent): UpdateStatus {
  switch (event.type) {
    case 'checking':
      return { phase: 'checking' }
    case 'available':
      return { phase: 'available', version: event.version }
    case 'not-available':
      return { phase: 'up-to-date' }
    case 'download-progress':
      return { phase: 'downloading', version: versionFrom(current), percent: clampPercent(event.percent) }
    case 'downloaded':
      return { phase: 'downloaded', version: event.version }
    case 'error':
      return { phase: 'error', message: event.message }
    default:
      return assertNever(event)
  }
}

/**
 * Structural equality over the small status union. The store only republishes
 * when the fact actually moves, so a no-op re-dispatch keeps the snapshot
 * reference stable.
 * @param a - one status.
 * @param b - the other status.
 * @returns true when the two statuses carry identical fields.
 */
function equalStatus(a: UpdateStatus, b: UpdateStatus): boolean {
  switch (a.phase) {
    case 'unsupported':
    case 'idle':
    case 'checking':
    case 'up-to-date':
      return b.phase === a.phase
    case 'available':
    case 'downloaded':
      return b.phase === a.phase && b.version === a.version
    case 'downloading':
      return b.phase === 'downloading' && b.version === a.version && b.percent === a.percent
    case 'error':
      return b.phase === 'error' && b.message === a.message
    default:
      return assertNever(a)
  }
}

/** Minimal observable store over {@link UpdateStatus}, mirroring the client's `HostObservable`. */
export interface UpdateStatusStore {
  /** The current status; the same reference until the next change. */
  getSnapshot(): UpdateStatus
  /** Subscribe to changes; returns the unsubscribe function. */
  subscribe(fn: () => void): () => void
  /** Fold one event into the current status. */
  dispatch(event: UpdateEvent): void
}

/**
 * Create a status store seeded with an initial status.
 * @param initial - the starting status (defaults to idle).
 * @returns a store that publishes only on an actual transition.
 */
export function createUpdateStatusStore(initial: UpdateStatus = { phase: 'idle' }): UpdateStatusStore {
  let snapshot: UpdateStatus = initial
  const listeners = new Set<() => void>()

  const publish = (next: UpdateStatus): void => {
    if (equalStatus(next, snapshot)) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    dispatch: (event) => { publish(reduceUpdateStatus(snapshot, event)) },
  }
}
