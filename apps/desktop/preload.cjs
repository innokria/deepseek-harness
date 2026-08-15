'use strict'
const { contextBridge, ipcRenderer } = require('electron')

// Electron runs this preload in a sandboxed renderer (sandbox: true), which
// exposes only a limited CommonJS `require` and no Node module loader. It is
// therefore hand-authored CommonJS rather than compiled TypeScript.
contextBridge.exposeInMainWorld('dshDesktop', {
  platform: process.platform,
  electron: process.versions.electron,
  /** Minimize the shell window (frameless Windows caption). */
  minimize() {
    return ipcRenderer.invoke('dsh:window-minimize')
  },
  /** Toggle maximize / restore. */
  maximize() {
    return ipcRenderer.invoke('dsh:window-maximize')
  },
  /** Close the shell window (hides to tray unless quitting). */
  close() {
    return ipcRenderer.invoke('dsh:window-close')
  },
  /**
   * Subscribe to deep-link delivery (a `dsh://…` URL). Returns an unsubscribe
   * function; the callback receives the full URL string.
   */
  onDeepLink(callback) {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, url) => callback(url)
    ipcRenderer.on('dsh:deep-link', listener)
    return () => {
      ipcRenderer.removeListener('dsh:deep-link', listener)
    }
  },
  /**
   * Narrow auto-update bridge. Status values are plain JSON: either
   * `{ phase: 'unsupported' }` (no feed) or one of idle/checking/available/
   * downloading/downloaded/up-to-date/error. No privileged host method is
   * re-exposed beyond querying status and requesting a check or install.
   */
  updates: {
    getStatus: () => ipcRenderer.invoke('dsh:updater:get-status'),
    onStatus(callback) {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, status) => callback(status)
      ipcRenderer.on('dsh:updater:status', listener)
      return () => {
        ipcRenderer.removeListener('dsh:updater:status', listener)
      }
    },
    check: () => ipcRenderer.invoke('dsh:updater:check'),
    install: () => ipcRenderer.invoke('dsh:updater:install'),
  },
})
