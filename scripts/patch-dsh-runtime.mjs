// Patches for @deepseek-ai/dsh 0.1.7-rc.2 packaging quirks. Safe to re-run.
// Core runtime plugins shipped as devDependencies never reach production
// installs, so the profile module-fallback misses them; promote every
// installed @deepseek-ai/dsh-* devDependency to a dependency so the fallback
// closure links every plugin the base inserts. Uninstalled entries are
// skipped instead of crashing the postinstall.
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
