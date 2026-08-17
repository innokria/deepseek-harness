import { dirname } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectConnectingLocale,
  renderConnectingPage,
  type ConnectingLocale,
} from '../src/connecting-page.ts'
import { planLogReveal, revealLogFile, type LogRevealShell } from '../src/log.ts'
import { resolveDesktopEnv } from '../src/env.ts'

const LOCALES: { tag: string; locale: ConnectingLocale; starting: string; stalled: string; openLog: string }[] = [
  {
    tag: 'zh-CN',
    locale: 'zh',
    starting: '正在启动 DeepSeek Harness…',
    stalled: '启动时间比预期长。可以打开日志查看原因，窗口会继续等待。',
    openLog: '打开日志',
  },
  {
    tag: 'en-US',
    locale: 'en',
    starting: 'Starting DeepSeek Harness…',
    stalled: 'Startup is taking longer than expected. You can open the log; this window will keep waiting.',
    openLog: 'Open log',
  },
]

describe('detectConnectingLocale', () => {
  it.each([
    ['zh-CN', 'zh'],
    ['zh', 'zh'],
    ['zh-Hans', 'zh'],
    ['zh-TW', 'zh'],
    ['ZH-CN', 'zh'],
    ['ZH-TW', 'zh'],
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['fr-FR', 'en'],
    ['', 'en'],
  ])('maps %s to %s', (tag, expected) => {
    expect(detectConnectingLocale(tag)).toBe(expected)
  })
})

describe('renderConnectingPage (before timeout)', () => {
  it.each(LOCALES)('$tag: shows the starting copy without the log button', ({ locale, starting, openLog }) => {
    const html = renderConnectingPage({ locale, timedOut: false })
    expect(html).toContain(starting)
    expect(html).not.toContain(openLog)
    expect(html).not.toContain('id="open-log"')
    expect(html).toContain('class="stack"')
    expect(html).toContain('-webkit-app-region: drag')
  })
})

describe('renderConnectingPage (after timeout)', () => {
  it.each(LOCALES)('$tag: shows the stalled copy and the log button', ({ locale, stalled, openLog }) => {
    const html = renderConnectingPage({ locale, timedOut: true })
    expect(html).toContain(stalled)
    expect(html).toContain(openLog)
    expect(html).toContain('id="open-log"')
    expect(html).toContain('class="stack"')
    // The window stays draggable; the button opts out so a click reaches IPC.
    expect(html).toContain('-webkit-app-region: drag')
    expect(html).toContain('-webkit-app-region: no-drag')
    expect(html).toContain('window.dshDesktop.openLog')
  })
})

describe('planLogReveal', () => {
  it('returns a show-item-in-folder action for an existing log', () => {
    expect(planLogReveal('C:/tmp/harness.log', true))
      .toEqual({ kind: 'show-item-in-folder', path: 'C:/tmp/harness.log' })
  })

  it('falls back to opening the parent directory when the log is missing', () => {
    expect(planLogReveal('C:/tmp/harness.log', false))
      .toEqual({ kind: 'open-path', path: 'C:/tmp' })
  })
})

describe('revealLogFile (integration with injected shell)', () => {
  it('calls showItemInFolder with the absolute log path when the file exists', async () => {
    const logFile = 'C:/Users/me/AppData/Roaming/dsh-desktop/logs/harness.log'
    const showItemInFolder = vi.fn<(path: string) => void>()
    const openPath = vi.fn<(path: string) => Promise<string>>().mockResolvedValue('')
    const shell: LogRevealShell = { showItemInFolder, openPath }

    const result = await revealLogFile(logFile, shell, true)

    expect(result.action).toEqual({ kind: 'show-item-in-folder', path: logFile })
    expect(result.error).toBe('')
    expect(showItemInFolder).toHaveBeenCalledOnce()
    expect(showItemInFolder).toHaveBeenCalledWith(logFile)
    expect(openPath).not.toHaveBeenCalled()
  })

  it('opens the parent directory when the log file is missing', async () => {
    const logFile = 'C:/Users/me/AppData/Roaming/dsh-desktop/logs/harness.log'
    const showItemInFolder = vi.fn<(path: string) => void>()
    const openPath = vi.fn<(path: string) => Promise<string>>().mockResolvedValue('')
    const shell: LogRevealShell = { showItemInFolder, openPath }

    const result = await revealLogFile(logFile, shell, false)

    expect(result.action).toEqual({ kind: 'open-path', path: dirname(logFile) })
    expect(result.error).toBe('')
    expect(showItemInFolder).not.toHaveBeenCalled()
    expect(openPath).toHaveBeenCalledOnce()
    expect(openPath).toHaveBeenCalledWith(dirname(logFile))
  })

  it('propagates the openPath error string', async () => {
    const logFile = '/var/log/dsh-desktop/harness.log'
    const shell: LogRevealShell = {
      showItemInFolder: vi.fn<(path: string) => void>(),
      openPath: vi.fn<(path: string) => Promise<string>>().mockResolvedValue('parent does not exist'),
    }

    const result = await revealLogFile(logFile, shell, false)

    expect(result.error).toBe('parent does not exist')
  })
})

describe('resolveDesktopEnv (connecting-timeout override)', () => {
  const KEY = 'DSH_DESKTOP_CONNECTING_TIMEOUT_MS'
  let previous: string | undefined

  beforeEach(() => {
    previous = process.env[KEY]
  })
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY]
    else process.env[KEY] = previous
  })

  it('defaults to 15000 ms when the env var is unset', () => {
    delete process.env[KEY]
    const env = resolveDesktopEnv('/irrelevant')
    expect(env.connectingTimeoutMs).toBe(15_000)
  })

  it('parses a positive override with the same helper as other desktop env vars', () => {
    process.env[KEY] = '30000'
    const env = resolveDesktopEnv('/irrelevant')
    expect(env.connectingTimeoutMs).toBe(30_000)
  })

  it.each([
    ['0', 15_000],
    ['-5', 15_000],
    ['abc', 15_000],
    ['', 15_000],
  ])('falls back to the default when the value %s is not a positive number', (raw, expected) => {
    process.env[KEY] = raw
    const env = resolveDesktopEnv('/irrelevant')
    expect(env.connectingTimeoutMs).toBe(expected)
  })
})
