#!/usr/bin/env node
// Compiles templates/**.json (authoring sources) into the files the builder reads:
//   items/<slug>.json   engage-template item files
//   library.json        engage-library manifest (what the builder's loader reads)
//   catalog.json        richer search index (descriptions, industries, themes, styles, sections)
// Usage: node scripts/build.mjs           write outputs
//        node scripts/build.mjs --check   validate and fail if outputs are missing or stale
//        node scripts/build.mjs --dry     validate only
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT, categoryById, compileTree, imageById, loadSources, styleById, taxonomy, validateItem, validateMeta } from './lib.mjs'

const CHECK = process.argv.includes('--check')
const DRY = process.argv.includes('--dry') // validate only, write nothing
const LIBRARY_NAME = 'Engage Templates (Shine + Effix)'

const sources = loadSources()
const errors = []
const warnings = []
const outputs = new Map()
const items = []

const order = (kind) => (kind === 'page' ? taxonomy.categories.pages : taxonomy.categories.sections).map((c) => c.id)

for (const [slug, { file, data }] of sources) {
  const metaErrors = validateMeta(data.meta, file)
  if (metaErrors.length) {
    errors.push(...metaErrors)
    continue
  }
  const meta = data.meta
  const expectedDir = meta.kind === 'page' ? 'templates/pages/' : `templates/sections/${meta.category}/`
  if (!file.startsWith(expectedDir)) warnings.push(`${file}: expected under ${expectedDir}`)

  const style = styleById(meta.style)
  const ctx = { slug, style, sources, images: new Set(), sections: [], stack: [slug] }
  let tree
  try {
    tree = compileTree(data.tree, ctx)
  } catch (e) {
    errors.push(e.message)
    continue
  }

  const item = {
    format: 'engage-template',
    schemaVersion: 1,
    kind: meta.kind,
    tree,
    assets: [],
    requires: {},
    meta: {
      slug,
      title: meta.title,
      category: meta.category,
      description: meta.description,
      tags: meta.tags,
      industry: meta.industry,
      theme: style.theme,
      style: style.id,
      frameworks: meta.frameworks,
      ...(ctx.sections.length ? { sections: ctx.sections } : {}),
      images: [...ctx.images].sort().map((id) => {
        const img = imageById(id)
        return { id, url: img.url, source: img.source, license: img.license }
      }),
      version: meta.version || '1.0.0',
    },
  }
  const result = validateItem(item, { slug, kind: meta.kind })
  errors.push(...result.errors)
  warnings.push(...result.warnings)

  const category = categoryById(meta.kind, meta.category)
  const libraryEntry = {
    slug,
    kind: meta.kind,
    title: meta.title,
    category: category.label,
    tags: meta.tags,
    preview: `previews/${slug}.png`,
    file: `items/${slug}.json`,
  }
  items.push({ libraryEntry, meta: item.meta, nodes: result.nodes })
  outputs.set(`items/${slug}.json`, JSON.stringify(item, null, 2) + '\n')
}

items.sort((a, b) => {
  if (a.libraryEntry.kind !== b.libraryEntry.kind) return a.libraryEntry.kind === 'section' ? -1 : 1
  const o = order(a.libraryEntry.kind)
  const d = o.indexOf(a.meta.category) - o.indexOf(b.meta.category)
  return d || a.libraryEntry.title.localeCompare(b.libraryEntry.title)
})

const library = { format: 'engage-library', schemaVersion: 1, name: LIBRARY_NAME, items: items.map((i) => i.libraryEntry) }
outputs.set('library.json', JSON.stringify(library, null, 2) + '\n')

const count = (kind, id) => items.filter((i) => i.libraryEntry.kind === kind && i.meta.category === id).length
const catalog = {
  name: LIBRARY_NAME,
  schemaVersion: 1,
  frameworks: {
    shine: { css: 'https://cdn.jsdelivr.net/gh/asticore/shine@main/dist/shine.min.css', repo: 'https://github.com/asticore/shine' },
    effix: {
      css: 'https://cdn.jsdelivr.net/gh/asticore/effix@main/dist/effix.min.css',
      js: 'https://cdn.jsdelivr.net/gh/asticore/effix@main/dist/effix.min.js',
      repo: 'https://github.com/asticore/effix',
    },
  },
  categories: {
    sections: taxonomy.categories.sections.map((c) => ({ ...c, count: count('section', c.id) })),
    pages: taxonomy.categories.pages.map((c) => ({ ...c, count: count('page', c.id) })),
  },
  styles: taxonomy.styles.map(({ id, label, theme, colors, fonts }) => ({ id, label, theme, colors, fonts })),
  items: items.map(({ libraryEntry, meta }) => ({
    slug: meta.slug,
    kind: libraryEntry.kind,
    title: meta.title,
    category: meta.category,
    categoryLabel: libraryEntry.category,
    description: meta.description,
    tags: meta.tags,
    industry: meta.industry,
    theme: meta.theme,
    style: meta.style,
    frameworks: meta.frameworks,
    ...(meta.sections ? { sections: meta.sections } : {}),
    preview: libraryEntry.preview,
    file: libraryEntry.file,
  })),
}
outputs.set('catalog.json', JSON.stringify(catalog, null, 2) + '\n')

// Size limits from the builder's loader.
if (Buffer.byteLength(outputs.get('library.json')) > 500 * 1024) errors.push('library.json is over 500 KB')
if (items.length > 500) errors.push('more than 500 items')

for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`error ${e}`)

const stale = []
const expectedItems = new Set([...outputs.keys()].filter((p) => p.startsWith('items/')))
const existingItems = existsSync(join(ROOT, 'items')) ? readdirSync(join(ROOT, 'items')).map((n) => `items/${n}`) : []

if (CHECK) {
  for (const [p, text] of outputs) {
    const abs = join(ROOT, p)
    if (!existsSync(abs) || readFileSync(abs, 'utf8') !== text) stale.push(p)
  }
  for (const p of existingItems) if (!expectedItems.has(p)) stale.push(`${p} (orphan)`)
  for (const { libraryEntry } of items) if (!existsSync(join(ROOT, libraryEntry.preview))) stale.push(`${libraryEntry.preview} (missing; run npm run previews)`)
  for (const s of stale) console.error(`stale ${s}`)
} else if (!errors.length && !DRY) {
  mkdirSync(join(ROOT, 'items'), { recursive: true })
  for (const p of existingItems) if (!expectedItems.has(p)) unlinkSync(join(ROOT, p))
  for (const [p, text] of outputs) writeFileSync(join(ROOT, p), text)
}

const sections = items.filter((i) => i.libraryEntry.kind === 'section').length
console.log(`${items.length} items (${sections} sections, ${items.length - sections} pages), ${warnings.length} warnings, ${errors.length} errors${CHECK ? `, ${stale.length} stale` : ''}`)
process.exit(errors.length || stale.length ? 1 : 0)
