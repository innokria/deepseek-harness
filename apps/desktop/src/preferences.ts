import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** User-tunable desktop shell preferences persisted under `userData`. */
export interface DesktopPreferences {
  /** Allow the shell to raise native notifications. */
  notificationsEnabled: boolean
  /**
   * Register the packaged app to start at OS login (hidden). Defaults to
   * off; unpackaged Electron builds never apply this to the OS.
   */
  launchAtLoginEnabled: boolean
}

export const DEFAULT_PREFERENCES: DesktopPreferences = Object.freeze({
  notificationsEnabled: true,
  launchAtLoginEnabled: false,
})

/**
 * Coerce an arbitrary parsed JSON value into valid preferences: missing
 * fields and non-boolean values fall back to the defaults so a hand-edited
 * or corrupted file never crashes the shell.
 */
export function normalizePreferences(raw: unknown): DesktopPreferences {
  const source = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
  return {
    notificationsEnabled: typeof source.notificationsEnabled === 'boolean'
      ? source.notificationsEnabled
      : DEFAULT_PREFERENCES.notificationsEnabled,
    launchAtLoginEnabled: typeof source.launchAtLoginEnabled === 'boolean'
      ? source.launchAtLoginEnabled
      : DEFAULT_PREFERENCES.launchAtLoginEnabled,
  }
}

/** Read/write access to the preferences file, tolerant of any corruption. */
export interface PreferencesStore {
  read(): DesktopPreferences
  write(preferences: DesktopPreferences): void
}

/**
 * Create a preferences store backed by one JSON file.
 * @param filePath - Absolute path (typically under Electron `userData`).
 * @returns A store that reads defaults when the file is missing or corrupt.
 */
export function createPreferencesStore(filePath: string): PreferencesStore {
  return {
    read() {
      try {
        return normalizePreferences(JSON.parse(readFileSync(filePath, 'utf8')) as unknown)
      } catch {
        return { ...DEFAULT_PREFERENCES }
      }
    },
    write(preferences) {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8')
    },
  }
}
