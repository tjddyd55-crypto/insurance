const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  checkForDesktopUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  installDownloadedUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateError: (callback) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    const channel = 'update-error'
    const handler = () => {
      callback()
    }
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
  onForceUpdate: (callback) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    const channel = 'force-update'
    const handler = (_event, payload) => {
      callback(payload)
    }
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
  onDesktopUpdate: (callback) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    const onPayload = (_event, payload) => {
      callback(payload)
    }
    const onDownloaded = () => {
      callback({ phase: 'downloaded' })
    }
    ipcRenderer.on('desktop-update', onPayload)
    ipcRenderer.on('update-downloaded', onDownloaded)
    return () => {
      ipcRenderer.removeListener('desktop-update', onPayload)
      ipcRenderer.removeListener('update-downloaded', onDownloaded)
    }
  },
})
