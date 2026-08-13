'use strict'
const { contextBridge, ipcRenderer } = require('electron')

// Electron runs this preload in a sandboxed renderer (sandbox: true), which
// exposes only a limited CommonJS `require` and no Node module loader. It is
// therefore hand-authored CommonJS rather than compiled TypeScript.
contextBridge.exposeInMainWorld('dshDesktop', {
  platform: process.platform,
  electron: process.versions.electron,
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
})
