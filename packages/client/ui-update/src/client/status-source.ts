/**
 * Reactive adapter over the preload bridge: one `HostObservable` that seeds
 * from `getStatus()` and follows `onStatus` pushes. The source owns its bridge
 * subscription, so the plugin fiber can start and dispose it as one effect.
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopUpdateBridge, UpdateStatus } from './desktop-bridge.ts'

/** A status observable whose bridge subscription is explicitly started and disposed. */
export interface UpdateStatusSource extends HostObservable<UpdateStatus> {
  /** Seed from the bridge and begin following pushes. */
  start(): void
  /** Drop the bridge subscription and any listeners. */
  dispose(): void
}

/**
 * Structural equality over the status union, so a no-op re-publish keeps the
 * snapshot reference stable (the client `HostObservable` contract).
 * @param a - one status.
 * @param b - the other status.
 * @returns true when the two statuses carry identical fields.
 */
function sameStatus(a: UpdateStatus, b: UpdateStatus): boolean {
  if (a.phase !== b.phase) return false
  if (a.phase === 'available' || a.phase === 'downloaded') {
    return b.phase === a.phase && b.version === a.version
  }
  if (a.phase === 'downloading') {
    return b.phase === 'downloading' && b.version === a.version && b.percent === a.percent
  }
  if (a.phase === 'error') {
    return b.phase === 'error' && b.message === a.message
  }
  return true
}

/**
 * Create a status source backed by a desktop bridge.
 * @param bridge - the preload update bridge.
 * @returns a source that starts on demand and disposes its subscription.
 */
export function createUpdateStatusSource(bridge: DesktopUpdateBridge): UpdateStatusSource {
  let snapshot: UpdateStatus = { phase: 'idle' }
  const listeners = new Set<() => void>()
  let unsubscribe: (() => void) | null = null

  const publish = (next: UpdateStatus): void => {
    if (sameStatus(next, snapshot)) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    start() {
      // Subscribe before seeding so a pushed status is never lost between the
      // seed request and the subscription.
      unsubscribe = bridge.onStatus((status) => { publish(status) })
      void bridge.getStatus().then((status) => { publish(status) })
    },
    dispose() {
      unsubscribe?.()
      unsubscribe = null
      listeners.clear()
    },
  }
}
