import { app, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDshEnvironment, findAvailablePort, HOST, waitForServer } from './runtime.js'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const startupController = new AbortController()
let mainWindow
let serverProcess
let quitting = false
let fatalErrorShown = false
let recentLogs = []

function dshEntryPoint() {
  const path = join(sourceDirectory, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!existsSync(path)) throw new Error(`Bundled dsh entry point is missing: ${path}`)
  return path
}

function appendLog(chunk) {
  const lines = String(chunk).split(/\r?\n/).filter(Boolean)
  recentLogs = [...recentLogs, ...lines].slice(-80)
  for (const line of lines) console.log(`[dsh] ${line}`)
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: '#fff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
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
  await mainWindow.loadURL(url)
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
  await createWindow()
  try {
    await startServer()
  } catch (error) {
    if (!quitting) await showFatalError(error)
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('before-quit', () => {
  quitting = true
  stopServer()
})

app.on('window-all-closed', () => app.quit())
