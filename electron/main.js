import { app, BrowserWindow, ipcMain } from 'electron'
import axios from 'axios'
import path from 'path'
import semver from 'semver'
import { fileURLToPath } from 'url'
import { autoUpdater } from 'electron-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_VERSION_CHECK_URL =
  'https://insurance-production-7bd8.up.railway.app/api/version'
const VERSION_CHECK_URL = process.env.VERSION_CHECK_URL?.trim() || DEFAULT_VERSION_CHECK_URL
const CLIENT_LOG_URL =
  process.env.CLIENT_LOG_URL?.trim() ||
  VERSION_CHECK_URL.replace(/\/version\/?$/i, '/client-log')

function sendClientLog(payload) {
  const body = { ...payload, timestamp: Date.now(), platform: 'electron' }
  void axios
    .post(CLIENT_LOG_URL, body, {
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    })
    .catch(() => {
      console.log('[client-log] send failed')
    })
}

/** @type {BrowserWindow | null} */
let mainWindow = null

function registerWindowControlsIpc() {
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.on('window:maximize-toggle', () => {
    if (!mainWindow) {
      return
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })
}

function sendDesktopUpdate(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-update', payload)
  }
}

function registerAutoUpdaterIpc() {
  ipcMain.handle('app:check-for-updates', async () => {
    if (!app.isPackaged) {
      return { ok: false, code: 'dev' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        ok: true,
        updateVersion: result?.updateInfo?.version ?? null,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, code: 'error', message }
    }
  })

  ipcMain.handle('app:install-update', () => {
    if (!app.isPackaged) {
      return { ok: false, code: 'dev' }
    }
    autoUpdater.quitAndInstall()
    return { ok: true }
  })
}

function wireAutoUpdaterEvents() {
  autoUpdater.autoDownload = true

  autoUpdater.on('error', (err) => {
    console.log('update error:', err)
    sendClientLog({ type: 'update-error', error: String(err) })
    sendDesktopUpdate({
      phase: 'error',
      message: err.message,
    })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error')
    }
  })

  autoUpdater.on('checking-for-update', () => {
    console.log('checking for update...')
    sendClientLog({ type: 'checking-update' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('update available', info?.version)
    sendClientLog({ type: 'update-available', version: info?.version ?? null })
    sendDesktopUpdate({
      phase: 'available',
      version: info.version,
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('no update')
    sendClientLog({ type: 'no-update' })
    sendDesktopUpdate({ phase: 'not-available' })
  })

  autoUpdater.on('download-progress', (p) => {
    sendDesktopUpdate({
      phase: 'progress',
      percent: Math.round(p.percent),
    })
  })

  autoUpdater.on('update-downloaded', () => {
    sendClientLog({ type: 'update-downloaded' })
    sendDesktopUpdate({ phase: 'downloaded' })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded')
    }
  })
}

/**
 * @returns {Promise<boolean>} true if force-update was signaled (skip optional auto-updater noise)
 */
async function checkForceUpdateFromServer() {
  if (!app.isPackaged) {
    return false
  }
  try {
    const res = await axios.get(VERSION_CHECK_URL, {
      timeout: 10000,
      validateStatus: (s) => s >= 200 && s < 300,
      headers: { Accept: 'application/json' },
    })
    const { latestVersion, minVersion, forceUpdate, message: policyMessage } = res.data ?? {}
    if (!forceUpdate || typeof minVersion !== 'string') {
      return false
    }
    const currentVersion = app.getVersion()
    if (
      semver.valid(currentVersion) &&
      semver.valid(minVersion) &&
      semver.lt(currentVersion, minVersion)
    ) {
      const message =
        typeof policyMessage === 'string' ? policyMessage.trim() : ''
      sendClientLog({
        type: 'force-update-triggered',
        version: currentVersion,
        minVersion,
        latestVersion: latestVersion ?? null,
      })
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('force-update', {
          minVersion,
          latestVersion,
          message,
        })
      }
      return true
    }
  } catch (e) {
    console.warn('[version-policy] check failed', e instanceof Error ? e.message : e)
  }
  return false
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    frame: false,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hidden' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    mainWindow.loadURL('http://localhost:3000')
  }
}

app.whenReady().then(() => {
  registerWindowControlsIpc()
  registerAutoUpdaterIpc()
  createWindow()

  if (app.isPackaged) {
    wireAutoUpdaterEvents()
    void checkForceUpdateFromServer()
    void autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
