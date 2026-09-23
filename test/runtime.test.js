import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { announcedWebUrl, buildDshEnvironment, createWebUrlSignal, findAvailablePort, waitForServer } from '../src/runtime.js'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const packagedRuntimeCheckPath = fileURLToPath(new URL('../scripts/verify-packaged-app.mjs', import.meta.url))
const mainProcessPath = fileURLToPath(new URL('../src/main.js', import.meta.url))

test('bundles the current DeepSeek Harness release', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  assert.equal(packageJson.dependencies['@deepseek-ai/dsh'], '0.1.7-rc.1')
  assert.equal(packageJson.dependencies['@deepseek-ai/dsh-timeout'], '0.1.7-rc.1')
})

test('packaged runtime check targets the current DSH dependency graph', async () => {
  const runtimeCheck = await readFile(packagedRuntimeCheckPath, 'utf8')
  assert.match(runtimeCheck, /repoPackage\.dependencies/)
  assert.match(runtimeCheck, /startsWith\('@deepseek-ai\/'\)/)
})

test('findAvailablePort returns a bindable port', async () => {
  const port = await findAvailablePort()
  assert.ok(Number.isInteger(port) && port > 0)
})

test('waitForServer resolves when an HTTP server is ready', async t => {
  const server = createServer((request, response) => response.end('ok'))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const { port } = server.address()
  await waitForServer(`http://127.0.0.1:${port}`, { timeoutMs: 1_000, intervalMs: 10 })
})

test('buildDshEnvironment preserves the base environment and uses the official DSH home', () => {
  const environment = buildDshEnvironment({ baseEnvironment: { PATH: '/bin' } })
  assert.equal(environment.PATH, '/bin')
  assert.equal(environment.DSH_HOME, undefined)
  assert.equal(environment.ELECTRON_RUN_AS_NODE, '1')
})

test('DSH web process never opens the system browser', () => {
  return readFile(mainProcessPath, 'utf8').then(mainProcess => {
    assert.match(mainProcess, /'web', '--host', HOST, '--port', String\(port\), '--no-open'/)
  })
})

test('createWebUrlSignal resolves with an announcement that arrives after the wait starts', async () => {
  const signal = createWebUrlSignal()
  const pending = signal.wait({ timeoutMs: 1_000 })
  signal.announce('http://127.0.0.1:8787/?token=abc')
  assert.equal(await pending, 'http://127.0.0.1:8787/?token=abc')
})

test('createWebUrlSignal resolves with an announcement that arrived before the wait', async () => {
  const signal = createWebUrlSignal()
  signal.announce('http://127.0.0.1:8787/?token=abc')
  assert.equal(await signal.wait({ timeoutMs: 1_000 }), 'http://127.0.0.1:8787/?token=abc')
})

test('createWebUrlSignal keeps the first announced URL', async () => {
  const signal = createWebUrlSignal()
  signal.announce('http://127.0.0.1:8787/?token=first')
  signal.announce('http://127.0.0.1:8787/?token=second')
  assert.equal(await signal.wait({ timeoutMs: 1_000 }), 'http://127.0.0.1:8787/?token=first')
})

test('createWebUrlSignal fails loudly instead of leaving the window unauthenticated', async () => {
  const signal = createWebUrlSignal()
  await assert.rejects(signal.wait({ timeoutMs: 20 }), /did not announce its web URL/)
})

test('createWebUrlSignal rejects with the abort reason', async () => {
  const controller = new AbortController()
  const signal = createWebUrlSignal()
  const pending = signal.wait({ timeoutMs: 1_000, signal: controller.signal })
  controller.abort(new Error('Application is quitting'))
  await assert.rejects(pending, /Application is quitting/)
})

test('announcedWebUrl extracts the token URL from the dsh web banner', () => {
  assert.equal(
    announcedWebUrl('dsh web: http://127.0.0.1:52517/?token=Ec0gpduNtv'),
    'http://127.0.0.1:52517/?token=Ec0gpduNtv'
  )
  assert.equal(announcedWebUrl('dsh web: opening the default browser'), undefined)
})

test('the window loads the announced URL, never the bare origin', async () => {
  const mainProcess = await readFile(mainProcessPath, 'utf8')
  assert.match(mainProcess, /await mainWindow\.loadURL\(authenticatedUrl\)/)
  assert.doesNotMatch(mainProcess, /loadURL\(webUrl \?\? url\)/)
})

test('every @deepseek-ai peer dependency is installed in the bundled graph', async () => {
  const modules = fileURLToPath(new URL('../node_modules/@deepseek-ai', import.meta.url))
  const missing = []
  for (const entry of await readdir(modules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let manifest
    try {
      manifest = JSON.parse(await readFile(join(modules, entry.name, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (!peer.startsWith('@deepseek-ai/')) continue
      if (!existsSync(join(modules, peer.slice('@deepseek-ai/'.length)))) {
        missing.push(`${peer} (exigido por ${manifest.name})`)
      }
    }
  }
  assert.deepEqual(missing, [], `peers ausentes — o app quebra no boot:\n${missing.join('\n')}`)
})
