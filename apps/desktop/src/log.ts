import { dirname } from 'node:path'

/**
 * Testable decision and dispatcher for "open harness log in file manager".
 *
 * The shell exposes a tray item and a connecting-page button that both call
 * into {@link revealLogFile}. The file manager reveal is delegated to
 * Electron's `shell.showItemInFolder`; tests inject a stub so they never
 * touch the real OS file manager.
 */

/** What the reveal will do, computed by {@link planLogReveal}. */
export type LogRevealAction =
  | { kind: 'show-item-in-folder'; path: string }
  | { kind: 'open-path'; path: string }

/**
 * Pick the reveal action for a log path.
 *
 * - When the log file already exists, ask the file manager to highlight it
 *   (`shell.showItemInFolder`).
 * - When the log file is missing — the harness supervisor always creates
 *   the parent directory, so this is a rare path — fall back to opening
 *   the parent directory in the file manager. The empty log file is not
 *   synthesised: an empty `harness.log` would mislead anyone looking at
 *   the timestamp.
 *
 * @param logFile - Absolute path to `harness.log`.
 * @param fileExists - Whether the log file is currently on disk.
 * @returns The action the caller should execute.
 */
export function planLogReveal(logFile: string, fileExists: boolean): LogRevealAction {
  if (fileExists) return { kind: 'show-item-in-folder', path: logFile }
  return { kind: 'open-path', path: dirname(logFile) }
}

/** Electron shell operations the reveal needs. */
export interface LogRevealShell {
  /** Synchronous reveal of one file in the OS file manager. */
  showItemInFolder(path: string): void
  /**
   * Open a path in the OS file manager. Resolves with an empty string on
   * success or an error string on failure.
   */
  openPath(path: string): Promise<string>
}

/** Result of a single reveal attempt. */
export interface LogRevealResult {
  /** The action that was actually taken. */
  action: LogRevealAction
  /** Empty on success, otherwise the error from `shell.openPath`. */
  error: string
}

/**
 * Reveal `harness.log` in the OS file manager.
 *
 * @param logFile - Absolute path to `harness.log`.
 * @param shell - Electron shell operations (injected for tests).
 * @param fileExists - Whether the log file is currently on disk (injected).
 * @returns The action that ran and any error from `openPath`.
 */
export async function revealLogFile(
  logFile: string,
  shell: LogRevealShell,
  fileExists: boolean,
): Promise<LogRevealResult> {
  const action = planLogReveal(logFile, fileExists)
  if (action.kind === 'show-item-in-folder') {
    shell.showItemInFolder(action.path)
    return { action, error: '' }
  }
  const error = await shell.openPath(action.path)
  return { action, error }
}
