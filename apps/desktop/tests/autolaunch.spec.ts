import { describe, expect, it } from 'vitest'
import { HIDDEN_LAUNCH_ARG, shouldStartHidden } from '../src/autolaunch.ts'

describe('desktop hidden launch', () => {
  it('hides on Windows when the registered hidden argument is present', () => {
    expect(shouldStartHidden({
      argv: [process.execPath, HIDDEN_LAUNCH_ARG],
      openedAtLogin: false,
      platform: 'win32',
    })).toBe(true)
  })

  it('stays visible on Windows without the hidden argument', () => {
    expect(shouldStartHidden({
      argv: [process.execPath],
      openedAtLogin: false,
      platform: 'win32',
    })).toBe(false)
  })

  it('follows the OS login signal on macOS regardless of argv', () => {
    expect(shouldStartHidden({
      argv: [process.execPath, HIDDEN_LAUNCH_ARG],
      openedAtLogin: true,
      platform: 'darwin',
    })).toBe(true)
    expect(shouldStartHidden({
      argv: [process.execPath],
      openedAtLogin: false,
      platform: 'darwin',
    })).toBe(false)
  })
})
