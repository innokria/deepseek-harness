/** Argument registered on Windows so an autostart launch can stay hidden. */
export const HIDDEN_LAUNCH_ARG = '--hidden'

/**
 * Decide whether this launch must keep the window hidden (an autostart
 * launch). Windows registers the flag as a Run-key argument, so it shows up
 * in `argv`; macOS login items (SMAppService) accept no custom arguments, so
 * the OS's own `wasOpenedAtLogin` signal is authoritative there.
 */
export function shouldStartHidden(options: {
  argv: readonly string[]
  openedAtLogin: boolean
  platform: NodeJS.Platform
}): boolean {
  if (options.platform === 'darwin') return options.openedAtLogin
  return options.argv.includes(HIDDEN_LAUNCH_ARG)
}

/** Login-item access supplied by the Electron main process. */
export interface LoginItemController {
  /** Whether the OS currently launches this app at login. */
  isEnabled(): boolean
  /** Register or unregister the app with the OS login items. */
  setEnabled(enabled: boolean): void
}
