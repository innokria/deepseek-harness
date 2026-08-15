/** A native notification the shell may raise. */
export interface ShellNotification {
  title: string
  body: string
}

/** Backend that actually presents notifications, injected from Electron. */
export interface NotificationSink {
  show(notification: ShellNotification): void
}

export const RESTART_NOTIFICATION: ShellNotification = {
  title: 'DeepSeek Harness 意外退出',
  body: '正在自动重启，窗口稍后恢复。',
}

export const REPEATED_RESTART_NOTIFICATION: ShellNotification = {
  title: 'DeepSeek Harness 反复崩溃',
  body: '已连续重启失败 3 次，可打开日志排查。',
}

export const RECOVERED_NOTIFICATION: ShellNotification = {
  title: 'DeepSeek Harness 已恢复',
  body: '服务已恢复正常。',
}

/** Stable throttle key for the recovery notification. */
export const RECOVERED_KEY = 'recovered'

/**
 * Map a supervisor restart attempt to the notification it deserves: the
 * first attempt announces the restart, the third escalates to a repeated
 * failure warning, everything in between stays quiet.
 */
export function restartNotificationFor(
  attempt: number,
): { key: string; notification: ShellNotification } | undefined {
  if (attempt === 1) return { key: 'restart', notification: RESTART_NOTIFICATION }
  if (attempt === 3) return { key: 'repeated-restart', notification: REPEATED_RESTART_NOTIFICATION }
  return undefined
}

/** Rate limiter that allows one notification per key within a window. */
export interface NotificationThrottle {
  /** Record the attempt and report whether it may be shown now. */
  allow(key: string, nowMs: number): boolean
}

/**
 * Create a throttle that suppresses a key inside `throttleMs`. A suppressed
 * call does not extend the window, so bursts stay collapsed to one message
 * until the window has genuinely elapsed.
 */
export function createNotificationThrottle(throttleMs: number): NotificationThrottle {
  const lastShown = new Map<string, number>()
  return {
    allow(key, nowMs) {
      const previous = lastShown.get(key)
      if (previous !== undefined && nowMs - previous < throttleMs) return false
      lastShown.set(key, nowMs)
      return true
    },
  }
}
