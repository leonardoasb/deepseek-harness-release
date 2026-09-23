// Patches for @deepseek-ai/dsh 0.1.7-rc.1 packaging quirks. Safe to re-run.
// 1) Core runtime plugins shipped as devDependencies never reach production
//    installs, so the profile module-fallback misses them; promote every
//    installed @deepseek-ai/dsh-* devDependency to a dependency so the fallback
//    closure links every plugin the base inserts. Uninstalled entries are
//    skipped instead of crashing the postinstall.
// 2) The web profile template ships patchReload "live", whose watcher crashes
//    standalone boots ("requires the Cordis HMR service"); every other profile
//    uses "startup", which applies patches once without watching.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const appRoot = join(process.cwd(), 'node_modules', '@deepseek-ai')

const dshManifestPath = join(appRoot, 'dsh', 'package.json')
const dshManifest = JSON.parse(readFileSync(dshManifestPath, 'utf8'))
dshManifest.dependencies ??= {}
let promoted = 0
for (const fullName of Object.keys(dshManifest.devDependencies ?? {})) {
  if (!fullName.startsWith('@deepseek-ai/dsh')) continue
  if (dshManifest.dependencies[fullName] !== undefined) continue
  const installedManifest = join(appRoot, fullName.slice('@deepseek-ai/'.length), 'package.json')
  if (!existsSync(installedManifest)) continue
  dshManifest.dependencies[fullName] = JSON.parse(readFileSync(installedManifest, 'utf8')).version
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
