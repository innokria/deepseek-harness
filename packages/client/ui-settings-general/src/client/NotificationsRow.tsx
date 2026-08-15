/**
 * Desktop-only system-notifications row for General settings. Talks to the
 * Electron shell through `window.dshDesktop`; hidden when that bridge is absent.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './LaunchAtLoginRow.module.css'

/** State returned by the desktop shell for this preference. */
export interface NotificationsState {
  enabled: boolean
}

/** Minimal desktop bridge surface used by this row. */
interface DesktopNotificationsBridge {
  getNotifications: () => Promise<NotificationsState>
  setNotifications: (enabled: boolean) => Promise<NotificationsState>
}

type WindowWithNotifications = Window & { dshDesktop?: DesktopNotificationsBridge }

/** Full component props: runtime share + locale seat. */
export type NotificationsRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'>

/**
 * Whether the Electron preload bridge exposes notification helpers.
 * @returns the bridge, or `undefined` outside the desktop shell.
 */
export function readDesktopNotificationsBridge(): DesktopNotificationsBridge | undefined {
  if (typeof window === 'undefined') return undefined
  const bridge = (window as WindowWithNotifications).dshDesktop
  if (bridge === undefined) return undefined
  if (typeof bridge.getNotifications !== 'function' || typeof bridge.setNotifications !== 'function') {
    return undefined
  }
  return bridge
}

/**
 * Render the system-notifications preference row (是 / 否). Defaults to 是.
 * @param props - composed slot props.
 * @returns the row element tree, or `null` when not running under desktop.
 */
export function NotificationsRow({ t }: NotificationsRowComponentProps) {
  const bridge = readDesktopNotificationsBridge()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (bridge === undefined) return
    let cancelled = false
    void bridge.getNotifications().then((state) => {
      if (cancelled) return
      setEnabled(state.enabled)
    })
    return () => { cancelled = true }
  }, [bridge])

  if (bridge === undefined) return null

  const activeId = enabled ? 'yes' : 'no'
  const options: { id: 'yes' | 'no'; label: string }[] = [
    { id: 'no', label: t('notifications.no') },
    { id: 'yes', label: t('notifications.yes') },
  ]
  const activeLabel = options.find(o => o.id === activeId)?.label ?? activeId

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('notifications.title')}</div>
        <div className={css.description}>{t('notifications.description')}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={options.map(o => ({ id: o.id, label: o.label }))}
        selectedId={activeId}
        onSelect={(id) => {
          const next = id === 'yes'
          setEnabled(next)
          setOpen(false)
          void bridge.setNotifications(next).then((state) => {
            setEnabled(state.enabled)
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
