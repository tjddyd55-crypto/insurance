const { app, BrowserWindow, ipcMain } = require('electron')
const axios = require('axios')
const path = require('path')
const semver = require('semver')
const { autoUpdater } = require('electron-updater')

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

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null

function registerVersionIpc() {
  ipcMain.handle('get-version', () => app.getVersion())
}

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

  /*
   * 사용자가 "시작" 버튼을 누른 순간부터 다운로드를 시작한다.
   * autoDownload=false 와 한 쌍으로 동작한다 — 렌더러 UX 가 다운로드 개시 권한을 갖는다.
   */
  ipcMain.handle('app:download-update', async () => {
    if (!app.isPackaged) {
      return { ok: false, code: 'dev' }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
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
  /*
   * autoDownload=false: 사용자가 명시적으로 "지금 시작" 을 눌러야 다운로드가 시작된다.
   * 그래야 사용자가 업데이트 존재를 인지한 상태에서 트래픽을 쓰게 된다.
   *
   * autoInstallOnAppQuit=true: 사용자가 "나중에" 를 선택해도 앱을 끄는 순간 조용히 적용된다.
   * 다음 실행부터 최신 버전. 강제 재시작은 하지 않는 운영 원칙.
   */
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

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
    sendDesktopUpdate({ phase: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('update available', info?.version)
    sendClientLog({ type: 'update-available', version: info?.version ?? null })
    sendDesktopUpdate({
      phase: 'available',
      version: info?.version ?? null,
      releaseDate: info?.releaseDate ?? null,
      /* releaseNotes 는 Markdown/HTML 일 수 있어 UI 에서 단순 텍스트로 축약 렌더한다. */
      releaseNotes:
        typeof info?.releaseNotes === 'string' ? info.releaseNotes : null,
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
      bytesPerSecond: Math.round(p.bytesPerSecond ?? 0),
      transferred: Math.round(p.transferred ?? 0),
      total: Math.round(p.total ?? 0),
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
    icon: path.join(__dirname, 'assets', 'app-icon.ico'),
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
  console.log('[InsuranceApp] Current app version:', app.getVersion())
  registerVersionIpc()
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
