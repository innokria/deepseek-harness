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
  ])('falls back to defaults for %o', (raw) => {
    expect(normalizePreferences(raw)).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps explicit boolean values', () => {
    expect(normalizePreferences({
      notificationsEnabled: false,
      launchAtLoginEnabled: true,
    })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: true,
    })
  })

  it('defaults launchAtLoginEnabled to false when omitted', () => {
    expect(normalizePreferences({ notificationsEnabled: false })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
    })
  })

  it('ignores unknown fields', () => {
    expect(normalizePreferences({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
      extra: 'junk',
    })).toEqual({
      notificationsEnabled: false,
      launchAtLoginEnabled: false,
    })
  })
})

describe('desktop preferences store', () => {
  it('reads defaults from a missing file and round-trips writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-preferences-'))
    try {
      const store = createPreferencesStore(join(dir, 'preferences.json'))
      expect(store.read()).toEqual(DEFAULT_PREFERENCES)

      store.write({ notificationsEnabled: false, launchAtLoginEnabled: true })
      expect(store.read()).toEqual({
        notificationsEnabled: false,
        launchAtLoginEnabled: true,
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
