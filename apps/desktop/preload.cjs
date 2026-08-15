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
  onDeepLink(callback) {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, url) => callback(url)
    ipcRenderer.on('dsh:deep-link', listener)
    return () => { ipcRenderer.removeListener('dsh:deep-link', listener) }
  },
})
