/** Sidebar-foot update action: an icon badge that appears while an update is in flight. */

import {
  IconDownloadOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { UpdateFooterActionFace } from './slots.ts'
import css from './UpdateFooterAction.module.css'

/** Full footer-action props composed by the `sidebar.footer.action` slot. */
export type UpdateFooterActionProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<UpdateFooterActionFace> & PropsLocale<'update'>

/**
 * Render the update badge, or nothing while the feed is idle, checking, or
 * current. A downloaded update is a single action: clicking it quits and
 * installs; otherwise the same install runs on the next ordinary quit.
 * @param props - composed slot props (owner share, inject face, locale seat).
 * @returns the badge element, or null when nothing is visible.
 */
export function UpdateFooterAction({
  wide,
  useStatus,
  onInstall,
  t,
}: UpdateFooterActionProps) {
  const status = useStatus(snapshot => snapshot)
  if (status.phase !== 'available' && status.phase !== 'downloading' && status.phase !== 'downloaded') {
    return null
  }
  const downloaded = status.phase === 'downloaded'
  const label = status.phase === 'downloading'
    ? t('downloading', { percent: status.percent })
    : t(status.phase, { version: status.version })

  return (
    <div className={wide ? css.layer : `${css.layer} ${css.rail}`}>
      <Tooltip label={label} side="right" delayMs={300} disabled={wide}>
        <button
          type="button"
          className={css.button}
          data-update-state={status.phase}
          aria-label={label}
          onClick={() => { if (downloaded) onInstall() }}
        >
          <IconDownloadOutline16 size={wide ? 14 : 18} />
          {wide && <span className={css.label}>{label}</span>}
        </button>
      </Tooltip>
    </div>
  )
}
