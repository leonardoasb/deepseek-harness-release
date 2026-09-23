import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildDshEnvironment, findAvailablePort, waitForServer } from '../src/runtime.js'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const packagedRuntimeCheckPath = fileURLToPath(new URL('../scripts/verify-packaged-app.mjs', import.meta.url))
const mainProcessPath = fileURLToPath(new URL('../src/main.js', import.meta.url))

test('bundles the current DeepSeek Harness release', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  assert.equal(packageJson.dependencies['@deepseek-ai/dsh'], '0.1.5-rc.2')
  assert.equal(packageJson.dependencies['@deepseek-ai/dsh-timeout'], '0.1.5-rc.2')
})

test('packaged runtime check targets the current DSH dependency graph', async () => {
  const runtimeCheck = await readFile(packagedRuntimeCheckPath, 'utf8')
  assert.match(runtimeCheck, /'@deepseek-ai\/dsh'/)
  assert.match(runtimeCheck, /'@deepseek-ai\/dsh-timeout'/)
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
