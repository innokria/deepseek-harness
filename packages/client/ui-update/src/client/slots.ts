/** Injected face of the update footer action. */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpdateStatus } from './desktop-bridge.ts'

/** Live facts and verbs the footer action receives from the plugin closure. */
export interface UpdateFooterActionFace {
  hooks: {
    /** The reactive update status source, bound to `useStatus` by the renderer. */
    status: HostObservable<UpdateStatus>
  }
  /** Quit and install the downloaded update (a no-op unless one is downloaded). */
  onInstall(): void
}
