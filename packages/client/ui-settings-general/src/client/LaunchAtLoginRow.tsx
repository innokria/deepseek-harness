/**
 * Desktop-only launch-at-login row for General settings. Talks to the Electron
 * shell through `window.dshDesktop`; hidden when that bridge is absent (browser).
 */
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './LaunchAtLoginRow.module.css'
import type { DshDesktopBridge, LaunchAtLoginState } from './dsh-desktop-bridge.ts'

export type { LaunchAtLoginState }

/** Launch-at-login methods required after the preload probe succeeds. */
type DesktopLaunchAtLoginBridge = Pick<DshDesktopBridge, 'getLaunchAtLogin' | 'setLaunchAtLogin'>

/** Full component props: runtime share + locale seat. */
export type LaunchAtLoginRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'>

/**
 * Whether the Electron preload bridge is present on this renderer.
 * @returns the bridge, or `undefined` outside the desktop shell.
 */
export function readDesktopLaunchAtLoginBridge(): DesktopLaunchAtLoginBridge | undefined {
  if (typeof window === 'undefined') return undefined
  const bridge = window.dshDesktop
  if (bridge === undefined) return undefined
  if (typeof bridge.getLaunchAtLogin !== 'function' || typeof bridge.setLaunchAtLogin !== 'function') {
    return undefined
  }
  return bridge as DesktopLaunchAtLoginBridge
}

/**
 * Render the launch-at-login preference row (是 / 否).
 * @param props - composed slot props.
 * @returns the row element tree, or `null` when not running under desktop.
 */
export function LaunchAtLoginRow({ t }: LaunchAtLoginRowComponentProps) {
  const bridge = readDesktopLaunchAtLoginBridge()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (bridge === undefined) return
    let cancelled = false
    void bridge.getLaunchAtLogin().then((state) => {
      if (cancelled) return
      setEnabled(state.enabled)
      setAvailable(state.available)
    })
    return () => { cancelled = true }
  }, [bridge])

  if (bridge === undefined) return null

  const activeId = enabled ? 'yes' : 'no'
  const options: { id: 'yes' | 'no'; label: string }[] = [
    { id: 'no', label: t('launchAtLogin.no') },
    { id: 'yes', label: t('launchAtLogin.yes') },
  ]
  const activeLabel = options.find(o => o.id === activeId)?.label ?? activeId

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('launchAtLogin.title')}</div>
        <div className={css.description}>{t('launchAtLogin.description')}</div>
      </div>
      <Menu
        open={open && available}
        onClose={() => { setOpen(false) }}
        items={options.map(o => ({ id: o.id, label: o.label }))}
        selectedId={activeId}
        onSelect={(id) => {
          const next = id === 'yes'
          setEnabled(next)
          setOpen(false)
          void bridge.setLaunchAtLogin(next).then((state) => {
            setEnabled(state.enabled)
            setAvailable(state.available)
          })
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open && available}
            aria-disabled={!available}
            disabled={!available}
            onClick={() => {
              if (!available) return
              setOpen(v => !v)
            }}
          >
            {activeLabel}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
