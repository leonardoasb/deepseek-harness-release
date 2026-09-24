import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const appRoot = join(process.cwd(), 'dist', 'mac-arm64', 'DeepSeek Harness.app')
const resources = join(appRoot, 'Contents', 'Resources', 'app')
const executable = join(appRoot, 'Contents', 'MacOS', 'DeepSeek Harness')
// Mantém a bateria em sincronia com o bundle: exige todo pacote @deepseek-ai
// declarado em dependencies, no lugar de uma lista fixa que envelhece.
const repoPackage = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
const requiredPackages = Object.keys(repoPackage.dependencies).filter(name => name.startsWith('@deepseek-ai/'))

for (const packageName of requiredPackages) {
  const manifest = join(resources, 'node_modules', packageName, 'package.json')
  if (!existsSync(manifest)) throw new Error('Packaged runtime dependency is missing: ' + packageName)
}

const child = spawn(executable, [], {
  env: { ...process.env, DSH_HOME: join(process.env.RUNNER_TEMP ?? '/tmp', 'dsh-packaged-smoke-' + process.pid) },
  stdio: ['ignore', 'pipe', 'pipe']
})
let output = ''
child.stdout.on('data', chunk => { output += chunk })
child.stderr.on('data', chunk => { output += chunk })

try {
  const deadline = Date.now() + 45_000
  let url
  while (Date.now() < deadline) {
    const match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\S*)/)
    if (match) {
      url = match[1]
      try {
        // The token exchange answers 303 with the session cookie; browsers
        // (and the app window) follow it, so treat any HTTP response as ready.
        await fetch(url, { redirect: 'manual' })
        break
      } catch {}
    }
    if (child.exitCode !== null) throw new Error('Packaged app exited with code ' + child.exitCode + ':\n' + output)
    await delay(250)
  }
  if (!url) throw new Error('Packaged app did not report its local URL:\n' + output)
  const response = await fetch(url, { redirect: 'manual' })
  if (![200, 303].includes(response.status)) throw new Error('Packaged app returned HTTP ' + response.status)
  console.log('Packaged app smoke test passed: ' + url + ' returned HTTP ' + response.status)
} finally {
  child.kill('SIGTERM')
}
