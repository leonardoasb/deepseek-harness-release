// Patches for @deepseek-ai/dsh 0.1.5-rc.2 packaging quirks. Safe to re-run.
// 1) Core runtime plugins shipped as devDependencies never reach production
//    installs, so the profile module-fallback misses them; promote them to
//    dependencies so the fallback closure links every plugin the base inserts.
// 2) The web profile template ships patchReload "live", whose watcher crashes
//    standalone boots ("requires the Cordis HMR service"); every other profile
//    uses "startup", which applies patches once without watching.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const appRoot = join(process.cwd(), 'node_modules', '@deepseek-ai')
const corePlugins = [
  'dsh-agent-loop',
  'dsh-api-session-controller',
  'dsh-attachment-local',
  'dsh-commands',
  'dsh-jobs-local',
  'dsh-llm-deepseek',
  'dsh-session-log-export',
  'dsh-session-persistence-jsonl',
  'dsh-session-query-sqlite',
  'dsh-settings-file',
  'dsh-subagent',
  'dsh-subagent-fork-in-process',
  'dsh-subagent-spawn-in-process'
]

const dshManifestPath = join(appRoot, 'dsh', 'package.json')
const dshManifest = JSON.parse(readFileSync(dshManifestPath, 'utf8'))
dshManifest.dependencies ??= {}
let promoted = 0
for (const name of corePlugins) {
  const fullName = '@deepseek-ai/' + name
  if (dshManifest.dependencies[fullName] !== undefined) continue
  const spec = dshManifest.devDependencies?.[fullName]
    ?? JSON.parse(readFileSync(join(appRoot, name, 'package.json'), 'utf8')).version
  dshManifest.dependencies[fullName] = spec
  promoted += 1
}
writeFileSync(dshManifestPath, JSON.stringify(dshManifest, null, 2) + '\n')
console.log(`patch-dsh-runtime: ${promoted} core plugin(s) promoted to dependencies`)

const bootModulePath = join(appRoot, 'dsh-app-boot', 'lib', 'index.js')
const bootModule = readFileSync(bootModulePath, 'utf8')
const liveTemplate = 'web: {\n\t\tbundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"],\n\t\tpatchReload: "live"'
const startupTemplate = 'web: {\n\t\tbundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"],\n\t\tpatchReload: "startup"'
if (bootModule.includes(liveTemplate)) {
  writeFileSync(bootModulePath, bootModule.replace(liveTemplate, startupTemplate))
  console.log('patch-dsh-runtime: web profile patchReload live -> startup')
} else if (bootModule.includes(startupTemplate)) {
  console.log('patch-dsh-runtime: web profile patchReload already startup')
} else {
  console.log('patch-dsh-runtime: web profile template not found; skipping patchReload patch')
}
