import { app, BrowserWindow, Menu, nativeImage, nativeTheme, Tray, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { announcedWebUrl, buildDshEnvironment, createWebUrlSignal, findAvailablePort, HOST, waitForServer } from './runtime.js'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const startupController = new AbortController()
let mainWindow
let tray
let serverProcess
let quitting = false
let fatalErrorShown = false
let recentLogs = []
const webUrlSignal = createWebUrlSignal()

function dshEntryPoint() {
  const path = join(sourceDirectory, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!existsSync(path)) throw new Error(`Bundled dsh entry point is missing: ${path}`)
  return path
}

function appendLog(chunk) {
  const lines = String(chunk).split(/\r?\n/).filter(Boolean)
  recentLogs = [...recentLogs, ...lines].slice(-80)
  for (const line of lines) {
    const announced = announcedWebUrl(line)
    if (announced !== undefined) webUrlSignal.announce(announced)
    console.log(`[dsh] ${line}`)
  }
}

function backgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#ffffff'
}

function applyTheme() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(backgroundColor())
}

function showStartupPage(message = 'Starting the local DeepSeek Harness service…') {
  const page = join(sourceDirectory, 'startup.html')
  return mainWindow.loadFile(page, { query: { message } })
}

async function showFatalError(error) {
  if (fatalErrorShown) return
  fatalErrorShown = true
  const details = [error instanceof Error ? error.stack ?? error.message : String(error), '', ...recentLogs].join('\n')
  console.error(details)
  if (mainWindow && !mainWindow.isDestroyed()) {
    await showStartupPage('DeepSeek Harness failed to start. See the dialog for details.')
  }
  dialog.showErrorBox('DeepSeek Harness could not start', details)
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  const icon = nativeImage.createFromPath(join(sourceDirectory, 'brand.png')).resize({ height: 18 })
  tray = new Tray(icon)
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DeepSeek Harness', click: showWindow },
    { type: 'separator' },
    { label: 'Quit DeepSeek Harness', click: () => app.quit() }
  ]))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: backgroundColor(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  // Closing the window keeps the harness running in the tray; Quit (Cmd+Q or
  // the tray menu) sets `quitting` first, so this interception steps aside.
  mainWindow.on('close', event => {
    if (!quitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://${HOST}:`) && !url.startsWith('file:')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })
  return showStartupPage()
}

async function startServer() {
  const port = await findAvailablePort()
  const url = `http://${HOST}:${port}`

  serverProcess = spawn(process.execPath, ['--expose-internals', dshEntryPoint(), 'web', '--host', HOST, '--port', String(port), '--no-open'], {
    cwd: app.getPath('home'),
    env: buildDshEnvironment({ baseEnvironment: process.env }),
    stdio: ['ignore', 'pipe', 'pipe']
  })
  serverProcess.stdout.on('data', appendLog)
  serverProcess.stderr.on('data', appendLog)
  serverProcess.once('error', error => void showFatalError(error))
  serverProcess.once('exit', (code, signal) => {
    serverProcess = undefined
    if (!quitting) void showFatalError(new Error(`dsh exited unexpectedly (${signal ?? `code ${code}`})`))
  })

  await waitForServer(url, { signal: startupController.signal })
  const authenticatedUrl = await webUrlSignal.wait({ signal: startupController.signal })
  await mainWindow.loadURL(authenticatedUrl)
}

function stopServer() {
  startupController.abort(new Error('Application is quitting'))
  if (!serverProcess || serverProcess.killed) return
  serverProcess.kill('SIGTERM')
  const processToKill = serverProcess
  setTimeout(() => {
    if (processToKill.exitCode === null) processToKill.kill('SIGKILL')
  }, 3_000).unref()
}

app.whenReady().then(async () => {
  // The window chrome and startup page follow the macOS appearance; the DSH
  // web UI keeps its own in-app theme setting.
  nativeTheme.themeSource = 'system'
  nativeTheme.on('updated', applyTheme)
  createTray()
  await createWindow()
  try {
    await startServer()
  } catch (error) {
    if (!quitting) await showFatalError(error)
  }
})

app.on('activate', () => showWindow())

app.on('before-quit', () => {
  quitting = true
  stopServer()
})

// Keep running in the background: closing the window only hides it. Quitting
// happens through Cmd+Q or the tray menu, which trigger `before-quit`.
app.on('window-all-closed', () => {})
