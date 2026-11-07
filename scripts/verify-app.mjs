#!/usr/bin/env node
// Optional deep check against a local checkout of the builder app (gracengatsby).
// Bundles the app's own validators with esbuild and runs every item through them:
//   - validateLibraryManifest (library.json)
//   - validateTemplate        (each items/*.json)
//   - asBlockStyle            (each design object: reports keys the app would drop)
// Usage: node scripts/verify-app.mjs --app ../gracengatsby
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { ROOT } from './lib.mjs'

const argApp = process.argv.indexOf('--app')
const app = resolve(argApp > 0 ? process.argv[argApp + 1] : '../gracengatsby')
const work = mkdtempSync(join(tmpdir(), 'engage-verify-'))

writeFileSync(
  join(work, 'entry.ts'),
  `export { validateLibraryManifest } from '@/features/templateLibraries/manifest'
export { validateTemplate } from '@/features/templateRepos/manifest'
export { asBlockStyle } from '@/lib/blockStyle'
`,
)
execFileSync(
  'npx',
  ['-y', 'esbuild@0.24.0', 'entry.ts', '--bundle', '--platform=node', '--format=cjs', '--outfile=out.cjs', `--alias:@=${join(app, 'src')}`,
    '--loader:.tsx=tsx', '--jsx=automatic', '--external:react', '--external:react/jsx-runtime', '--external:next/*', '--external:payload',
    '--external:@payloadcms/*', '--external:server-only', '--log-level=error'],
  { cwd: work, stdio: 'inherit' },
)
const require = createRequire(import.meta.url)
const { validateLibraryManifest, validateTemplate, asBlockStyle } = require(join(work, 'out.cjs'))

let problems = 0
const report = (m) => {
  problems++
  console.error(m)
}

const lib = validateLibraryManifest(JSON.parse(readFileSync(join(ROOT, 'library.json'), 'utf8')))
if (!lib.ok) report(`library.json: ${lib.error}`)

const walkDesign = (node, path, slug) => {
  if (Array.isArray(node)) return node.forEach((n, i) => walkDesign(n, `${path}[${i}]`, slug))
  if (!node || typeof node !== 'object') return
  if (node.design && typeof node.design === 'object') {
    const kept = asBlockStyle(node.design)
    for (const key of Object.keys(node.design)) if (!(key in kept)) report(`${slug}: ${path}.design.${key} is dropped by the app`)
    for (const dev of ['tablet', 'mobile']) {
      if (node.design[dev] && kept[dev]) for (const key of Object.keys(node.design[dev])) if (!(key in kept[dev])) report(`${slug}: ${path}.design.${dev}.${key} is dropped by the app`)
    }
  }
  for (const [k, v] of Object.entries(node)) if (k !== 'design') walkDesign(v, `${path}.${k}`, slug)
}

const files = readdirSync(join(ROOT, 'items')).filter((n) => n.endsWith('.json'))
for (const name of files) {
  const data = JSON.parse(readFileSync(join(ROOT, 'items', name), 'utf8'))
  const res = validateTemplate(data)
  if (!res.ok) report(`${name}: ${res.error}`)
  walkDesign(data.tree, 'tree', name)
}
console.log(`${files.length} items checked against ${app}: ${problems} problems`)
process.exit(problems ? 1 : 0)
