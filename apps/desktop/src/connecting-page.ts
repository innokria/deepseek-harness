/**
 * Pure rendering of the desktop shell's "connecting" placeholder.
 *
 * The page is loaded into the same `BrowserWindow` that will eventually
 * host the Web GUI. It is a `data:text/html` document so a single
 * `loadURL` call replaces it when the harness reports ready; the
 * tray/preload/IPC wiring stays identical between both states.
 */

/** Languages the connecting placeholder knows. */
export type ConnectingLocale = 'zh' | 'en'

/** A single translated string the page renders. */
interface ConnectingCopy {
  /** The pre-timeout headline shown while the harness is starting. */
  starting: string
  /** The post-timeout message telling the user the start is slow. */
  stalled: string
  /** The label of the button that reveals `harness.log` in the file manager. */
  openLog: string
}

/** Chinese (Simplified) copy; the product is shipped in zh-CN by default. */
const ZH: ConnectingCopy = {
  starting: '正在启动 DeepSeek Harness…',
  stalled: '启动时间比预期长。可以打开日志查看原因，窗口会继续等待。',
  openLog: '打开日志',
}

/** English copy; the fallback for any non-`zh*` Electron locale. */
const EN: ConnectingCopy = {
  starting: 'Starting DeepSeek Harness…',
  stalled: 'Startup is taking longer than expected. You can open the log; this window will keep waiting.',
  openLog: 'Open log',
}

/** The strings used for one locale, indexed by {@link ConnectingLocale}. */
const COPY: Record<ConnectingLocale, ConnectingCopy> = { zh: ZH, en: EN }

/**
 * Map an Electron `app.getLocale()` tag to a {@link ConnectingLocale}.
 * @param localeTag - Raw locale string from `app.getLocale()` (e.g. `zh-CN`, `en-US`).
 * @returns `zh` for any tag starting with `zh` (case-insensitive), else `en`.
 */
export function detectConnectingLocale(localeTag: string): ConnectingLocale {
  return localeTag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** Inputs the connecting renderer needs. */
export interface ConnectingPageInput {
  /** Selected language for the visible copy. */
  locale: ConnectingLocale
  /**
   * True once the supervisor has waited past the connecting timeout without
   * the harness reporting ready. The page still keeps waiting after this
   * state changes; it only adds a longer explanation and a log-reveal button.
   */
  timedOut: boolean
}

/**
 * Render the connecting placeholder as a self-contained HTML document.
 * @param input - Language and timeout state; both are mandatory.
 * @returns A UTF-8 HTML string safe to embed behind `data:text/html;charset=utf-8,<…>`.
 */
export function renderConnectingPage(input: ConnectingPageInput): string {
  const copy = COPY[input.locale]
  const headline = input.timedOut ? copy.stalled : copy.starting
  const button = input.timedOut
    ? `<button type="button" id="open-log" class="open-log">${copy.openLog}</button>`
    : ''
  return `<!doctype html>
<meta charset="utf-8">
<title>DeepSeek Harness</title>
<style>
  body { margin: 0; display: grid; place-items: center; height: 100vh;
         font: 14px/1.5 system-ui, -apple-system, sans-serif; color: #9aa0a6;
         background: #1f2328; -webkit-app-region: drag; }
  .stack { display: grid; justify-items: center; gap: 1.25em;
           max-width: 32em; padding: 0 1.5em; }
  p { margin: 0; text-align: center; }
  .open-log { padding: 0.4em 1em; font: inherit;
              color: #c9d1d9; background: #2d333b; border: 1px solid #444c56;
              border-radius: 4px; cursor: pointer;
              -webkit-app-region: no-drag; }
  .open-log:hover { background: #373e47; }
</style>
<div class="stack">
<p>${headline}</p>${button}
</div>
<script>
  var btn = document.getElementById('open-log');
  if (btn !== null && window.dshDesktop !== undefined && typeof window.dshDesktop.openLog === 'function') {
    btn.addEventListener('click', function () { window.dshDesktop.openLog(); });
  }
</script>`
}
