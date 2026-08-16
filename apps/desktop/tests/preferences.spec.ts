import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from '../src/preferences.ts'

describe('desktop preferences normalization', () => {
  it.each([
    undefined,
    null,
    'not an object',
    42,
    {},
    { notificationsEnabled: 'yes' },
    { notificationsEnabled: 1 },
    { launchAtLoginEnabled: 'yes' },
    { closeBehavior: 'minimize' },
    { closeBehavior: 1 },
  ])('falls back to defaults for %o', (raw) => {
    expect(normalizePreferences(raw)).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps explicit boolean values and a valid close behavior', () => {
    expect(normalizePreferences({
      notificationsEnabled: false,
      launchAtLoginEnabled: true,
      closeBehavior: 'quit',
    })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: true,
      closeBehavior: 'quit',
    })
  })

  it('defaults launchAtLoginEnabled to false and closeBehavior to tray when omitted', () => {
    expect(normalizePreferences({ notificationsEnabled: false })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
      closeBehavior: 'tray',
    })
  })

  it('ignores unknown fields', () => {
    expect(normalizePreferences({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
      closeBehavior: 'tray',
      extra: 'junk',
    })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
      closeBehavior: 'tray',
    })
  })
})

describe('desktop preferences store', () => {
  it('reads defaults from a missing file and round-trips writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-preferences-'))
    try {
      const store = createPreferencesStore(join(dir, 'preferences.json'))
      expect(store.read()).toEqual(DEFAULT_PREFERENCES)

      store.write({
        notificationsEnabled: false,
        launchAtLoginEnabled: true,
        closeBehavior: 'quit',
      })
      expect(store.read()).toEqual({
        notificationsEnabled: false,
        launchAtLoginEnabled: true,
        closeBehavior: 'quit',
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('falls back to defaults when the file is corrupt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-preferences-'))
    try {
      const file = join(dir, 'preferences.json')
      await writeFile(file, '{ this is not valid json', 'utf8')
      expect(createPreferencesStore(file).read()).toEqual(DEFAULT_PREFERENCES)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
