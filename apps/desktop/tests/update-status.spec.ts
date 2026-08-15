import { describe, expect, it, vi } from 'vitest'
import {
  createUpdateStatusStore,
  reduceUpdateStatus,
  type UpdateStatus,
} from '../src/update-status.ts'

describe('reduceUpdateStatus', () => {
  it('moves to checking and then up-to-date on a clean feed answer', () => {
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'checking' })).toEqual({ phase: 'checking' })
    expect(reduceUpdateStatus({ phase: 'checking' }, { type: 'not-available' })).toEqual({ phase: 'up-to-date' })
  })

  it('announces an available version', () => {
    expect(reduceUpdateStatus({ phase: 'checking' }, { type: 'available', version: '0.2.0' }))
      .toEqual({ phase: 'available', version: '0.2.0' })
  })

  it('carries the available version into download progress', () => {
    expect(
      reduceUpdateStatus({ phase: 'available', version: '0.2.0' }, { type: 'download-progress', percent: 42 }),
    ).toEqual({ phase: 'downloading', version: '0.2.0', percent: 42 })
  })

  it('keeps the version already carried by a prior downloading state', () => {
    expect(
      reduceUpdateStatus(
        { phase: 'downloading', version: '0.2.0', percent: 10 },
        { type: 'download-progress', percent: 55 },
      ),
    ).toEqual({ phase: 'downloading', version: '0.2.0', percent: 55 })
  })

  it('clamps and rounds the download percentage', () => {
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'download-progress', percent: -3 })).toMatchObject({ percent: 0 })
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'download-progress', percent: 250 })).toMatchObject({ percent: 100 })
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'download-progress', percent: 33.6 })).toMatchObject({ percent: 34 })
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'download-progress', percent: Number.NaN })).toMatchObject({ percent: 0 })
  })

  it('reports the downloaded and error outcomes', () => {
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'downloaded', version: '0.2.0' }))
      .toEqual({ phase: 'downloaded', version: '0.2.0' })
    expect(reduceUpdateStatus({ phase: 'idle' }, { type: 'error', message: 'network down' }))
      .toEqual({ phase: 'error', message: 'network down' })
  })
})

describe('createUpdateStatusStore', () => {
  it('publishes only on an actual transition and keeps the snapshot reference stable', () => {
    const store = createUpdateStatusStore()
    const idle = store.getSnapshot()
    store.dispatch({ type: 'checking' })
    const checking = store.getSnapshot()

    expect(idle).toEqual({ phase: 'idle' })
    expect(checking).toEqual({ phase: 'checking' })
    // Re-dispatching the same event produces an identical status object.
    store.dispatch({ type: 'checking' })
    expect(store.getSnapshot()).toBe(checking)
  })

  it('notifies subscribers on change and honours unsubscribe', () => {
    const store = createUpdateStatusStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.dispatch({ type: 'checking' })
    expect(listener).toHaveBeenCalledOnce()

    store.dispatch({ type: 'checking' })
    expect(listener).toHaveBeenCalledOnce()

    unsubscribe()
    store.dispatch({ type: 'available', version: '0.2.0' })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('can start from a supplied initial status', () => {
    const initial: UpdateStatus = { phase: 'downloaded', version: '0.2.0' }
    const store = createUpdateStatusStore(initial)
    expect(store.getSnapshot()).toBe(initial)
  })
})
