// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { UpdateFooterAction, type UpdateFooterActionProps } from '../src/client/UpdateFooterAction.tsx'
import type { UpdateStatus } from '../src/client/desktop-bridge.ts'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t: UpdateFooterActionProps['t'] = makeTranslate(zh)

function renderWith(status: UpdateStatus, wide = true): { onInstall: ReturnType<typeof vi.fn<() => void>>; container: HTMLElement } {
  function useStatus<T>(select: (snapshot: UpdateStatus) => T): T {
    return select(status)
  }
  const onInstall = vi.fn<() => void>()
  const { container } = render(
    <UpdateFooterAction {...{ wide, useStatus, onInstall, t } as unknown as UpdateFooterActionProps} />,
  )
  return { onInstall, container }
}

const HIDDEN: readonly UpdateStatus[] = [
  { phase: 'unsupported' },
  { phase: 'idle' },
  { phase: 'checking' },
  { phase: 'up-to-date' },
  { phase: 'error', message: 'boom' },
]

describe('UpdateFooterAction visibility', () => {
  it.each(HIDDEN)('renders nothing while $phase', (status) => {
    const { container } = renderWith(status)
    expect(container.innerHTML).toBe('')
  })

  it('labels an available version', () => {
    renderWith({ phase: 'available', version: '0.2.0' })
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('发现新版本 0.2.0')
  })

  it('labels the download percentage', () => {
    renderWith({ phase: 'downloading', version: '0.2.0', percent: 42 })
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('正在下载更新 42%')
  })

  it('labels the downloaded version and installs on click', () => {
    const { onInstall } = renderWith({ phase: 'downloaded', version: '0.2.0' })
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('已下载 0.2.0，重启后安装')
    fireEvent.click(screen.getByRole('button'))
    expect(onInstall).toHaveBeenCalledOnce()
  })

  it('does not install from a badge that is not downloaded', () => {
    const { onInstall } = renderWith({ phase: 'available', version: '0.2.0' })
    fireEvent.click(screen.getByRole('button'))
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('renders an icon-only button on the rail, keeping the label in the accessible name', () => {
    const { container } = renderWith({ phase: 'downloaded', version: '0.2.0' }, false)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toBe('已下载 0.2.0，重启后安装')
    expect(container.textContent).toBe('')
  })
})
