/**
 * Electron preload surface shared by desktop-only General settings rows.
 * One Window augmentation so launch-at-login and notifications can coexist.
 */

/** State returned by the desktop shell for launch-at-login. */
export interface LaunchAtLoginState {
  enabled: boolean
  available: boolean
}

/** State returned by the desktop shell for system notifications. */
export interface NotificationsState {
  enabled: boolean
}

/** Behavior the desktop shell applies when its main window closes. */
export type CloseBehavior = 'tray' | 'quit'

/** State returned by the desktop shell for window close behavior. */
export interface CloseBehaviorState {
  behavior: CloseBehavior
}

/** Full preload bridge. Individual rows only require the methods they call. */
export interface DshDesktopBridge {
  getLaunchAtLogin: () => Promise<LaunchAtLoginState>
  setLaunchAtLogin: (enabled: boolean) => Promise<LaunchAtLoginState>
  getNotifications: () => Promise<NotificationsState>
  setNotifications: (enabled: boolean) => Promise<NotificationsState>
  getCloseBehavior: () => Promise<CloseBehaviorState>
  setCloseBehavior: (behavior: CloseBehavior) => Promise<CloseBehaviorState>
}

declare global {
  interface Window {
    dshDesktop?: Partial<DshDesktopBridge>
  }
}
