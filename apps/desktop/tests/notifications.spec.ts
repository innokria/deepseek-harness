import { describe, expect, it } from 'vitest'
import {
  createNotificationThrottle,
  restartNotificationFor,
} from '../src/notifications.ts'

describe('desktop restart notifications', () => {
  it('announces the first restart attempt', () => {
    expect(restartNotificationFor(1)?.key).toBe('restart')
  })

  it('escalates on the third consecutive attempt', () => {
    expect(restartNotificationFor(3)?.key).toBe('repeated-restart')
  })

  it('stays quiet on the attempts in between and after', () => {
    expect(restartNotificationFor(2)).toBeUndefined()
    expect(restartNotificationFor(4)).toBeUndefined()
    expect(restartNotificationFor(5)).toBeUndefined()
  })
})

describe('desktop notification throttle', () => {
  it('allows the first occurrence of a key', () => {
    const throttle = createNotificationThrottle(60_000)
    expect(throttle.allow('restart', 1_000)).toBe(true)
  })

  it('suppresses a repeated key inside the window', () => {
    const throttle = createNotificationThrottle(60_000)
    throttle.allow('restart', 1_000)
    expect(throttle.allow('restart', 2_000)).toBe(false)
  })

  it('allows a repeated key once the window has elapsed', () => {
    const throttle = createNotificationThrottle(60_000)
    throttle.allow('restart', 1_000)
    expect(throttle.allow('restart', 61_000)).toBe(true)
  })

  it('tracks keys independently', () => {
    const throttle = createNotificationThrottle(60_000)
    throttle.allow('restart', 1_000)
    expect(throttle.allow('recovered', 2_000)).toBe(true)
  })
})
