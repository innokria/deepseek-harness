/**
 * Desktop-only window close-behavior row for General settings. Talks to the
 * Electron shell through `window.dshDesktop`; hidden when that bridge is absent.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './LaunchAtLoginRow.module.css'
import type { CloseBehavior, CloseBehaviorState, DshDesktopBridge } from './dsh-desktop-bridge.ts'

export type { CloseBehaviorState }

/** Close-behavior methods required after the preload probe succeeds. */
type DesktopCloseBehaviorBridge = Pick<DshDesktopBridge, 'getCloseBehavior' | 'setCloseBehavior'>

/** Full component props: runtime share + locale seat. */
export type CloseBehaviorRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'>

/**
 * Whether the Electron preload bridge exposes close-behavior helpers.
 * @returns the bridge, or `undefined` outside the desktop shell.
 */
export function readDesktopCloseBehaviorBridge(): DesktopCloseBehaviorBridge | undefined {
  if (typeof window === 'undefined') return undefined
  const bridge = window.dshDesktop
  if (bridge === undefined) return undefined
  if (typeof bridge.getCloseBehavior !== 'function' || typeof bridge.setCloseBehavior !== 'function') {
    return undefined
  }
  return bridge as DesktopCloseBehaviorBridge
}

/**
 * Render the window close-behavior preference row (Keep running / Quit).
 * Defaults to Keep running (tray), matching the shell preference default.
 * @param props - composed slot props.
 * @returns the row element tree, or `null` when not running under desktop.
 */
export function CloseBehaviorRow({ t }: CloseBehaviorRowComponentProps) {
  const bridge = readDesktopCloseBehaviorBridge()
  const [open, setOpen] = useState(false)
  const [behavior, setBehavior] = useState<CloseBehavior>('tray')

  useEffect(() => {
    if (bridge === undefined) return
    let cancelled = false
    void bridge.getCloseBehavior().then((state) => {
      if (cancelled) return
      setBehavior(state.behavior)
    })
    return () => { cancelled = true }
  }, [bridge])

  if (bridge === undefined) return null

  const options: { id: CloseBehavior; label: string }[] = [
    { id: 'tray', label: t('closeBehavior.keepRunning') },
    { id: 'quit', label: t('closeBehavior.quit') },
  ]
  const activeLabel = options.find(o => o.id === behavior)?.label ?? behavior

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('closeBehavior.title')}</div>
        <div className={css.description}>{t('closeBehavior.description')}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={options.map(o => ({ id: o.id, label: o.label }))}
        selectedId={behavior}
        onSelect={(id) => {
          const next = id === 'quit' ? 'quit' : 'tray'
          setBehavior(next)
          setOpen(false)
          void bridge.setCloseBehavior(next).then((state) => {
            setBehavior(state.behavior)
          })
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(v => !v) }}
          >
            {activeLabel}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
