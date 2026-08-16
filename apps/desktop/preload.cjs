'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', {
  platform: process.platform,
  electron: process.versions.electron,
  minimize() { return ipcRenderer.invoke('dsh:window-minimize') },
  maximize() { return ipcRenderer.invoke('dsh:window-maximize') },
  close() { return ipcRenderer.invoke('dsh:window-close') },
  getLaunchAtLogin() { return ipcRenderer.invoke('dsh:launch-at-login-get') },
  setLaunchAtLogin(enabled) { return ipcRenderer.invoke('dsh:launch-at-login-set', Boolean(enabled)) },
  getNotifications() { return ipcRenderer.invoke('dsh:notifications-get') },
  setNotifications(enabled) { return ipcRenderer.invoke('dsh:notifications-set', Boolean(enabled)) },
  getCloseBehavior() { return ipcRenderer.invoke('dsh:close-behavior-get') },
  setCloseBehavior(behavior) { return ipcRenderer.invoke('dsh:close-behavior-set', behavior === 'quit' ? 'quit' : 'tray') },
  onDeepLink(callback) {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, url) => callback(url)
    ipcRenderer.on('dsh:deep-link', listener)
    return () => { ipcRenderer.removeListener('dsh:deep-link', listener) }
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
