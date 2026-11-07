// Shared helpers for the engage-templates build: loading the taxonomy, compiling authoring
// shorthands into the strict engage-template format, and validating the result against the
// same rules the builder's loader applies (see reference/ and docs/TEMPLATE_SPEC.md).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

export const taxonomy = {
  categories: readJson('taxonomy/categories.json'),
  styles: readJson('taxonomy/styles.json').styles,
  images: readJson('taxonomy/images.json').images,
}
export const reference = {
  elements: readJson('reference/elements.json'),
  blocks: readJson('reference/blocks.json'),
  designKeys: new Set(readJson('reference/design-keys.json').keys),
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
export const FRAMEWORKS = ['shine', 'effix']

/* ---------------------------------------------------------------- files */

export function walkJson(dir) {
  const abs = join(ROOT, dir)
  let out = []
  let entries = []
  try {
    entries = readdirSync(abs)
  } catch {
    return out
  }
  for (const name of entries.sort()) {
    const full = join(abs, name)
    if (statSync(full).isDirectory()) out = out.concat(walkJson(join(dir, name)))
    else if (name.endsWith('.json')) out.push(relative(ROOT, full).split(sep).join('/'))
  }
  return out
}

/** Every authoring source file, keyed by slug. */
export function loadSources() {
  const map = new Map()
  for (const file of walkJson('templates')) {
    const data = readJson(file)
    const slug = data?.meta?.slug
    if (map.has(slug)) throw new Error(`Duplicate slug "${slug}" in ${file} and ${map.get(slug).file}`)
    map.set(slug, { file, data })
  }
  return map
}

/* ---------------------------------------------------------------- lookups */

export const categoryById = (kind, id) =>
  (kind === 'page' ? taxonomy.categories.pages : taxonomy.categories.sections).find((c) => c.id === id)

export const styleById = (id) => taxonomy.styles.find((s) => s.id === id)

export const imageById = (id) => taxonomy.images.find((i) => i.id === id)

/* ---------------------------------------------------------------- compile */

const IMG_RE = /^img:([a-z0-9-]+)(?:@(\d{2,4}))?(?:\|(.*))?$/
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9.]+)\s*\}\}/g

export function imageUrl(id, width = 1600) {
  const img = imageById(id)
  if (!img) return null
  return `${img.url}?w=${width}&q=80&auto=format&fit=crop`
}

function tokenValue(style, path) {
  if (path === 'radius') return style.radius
  const [group, key] = path.split('.')
  if (group === 'color') return style.colors[key] ?? (key === 'dark' ? style.colors.text : undefined)
  if (group === 'font') return style.fonts[key]
  return undefined
}

/** Plain text (blank line = new paragraph, **bold**, *italic*) to the builder's Lexical rich-text JSON. */
export function toLexical(text) {
  const paragraphs = String(text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const textNode = (t, format) => ({ type: 'text', version: 1, text: t, format, style: '', mode: 'normal', detail: 0 })
  const inline = (p) => {
    const nodes = []
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    let last = 0
    let m
    while ((m = re.exec(p))) {
      if (m.index > last) nodes.push(textNode(p.slice(last, m.index), 0))
      const bold = m[0].startsWith('**')
      nodes.push(textNode(m[0].slice(bold ? 2 : 1, bold ? -2 : -1), bold ? 1 : 2))
      last = m.index + m[0].length
    }
    if (last < p.length) nodes.push(textNode(p.slice(last), 0))
    return nodes
  }
  return {
    root: {
      type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
      children: paragraphs.map((p) => ({ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, children: inline(p) })),
    },
  }
}

/**
 * Compiles an authoring tree into a builder tree:
 *  - {"$section": "<slug>"} is replaced by that section's tree (pages are built from sections)
 *  - "img:<id>[@width][|alt]" strings become verified photo URLs; in a media prop they become {url, alt}
 *  - "{{color.primary}}", "{{font.heading}}", "{{radius}}" tokens are filled from the item's style
 *  - text-editor props.content given as a string becomes Lexical rich text
 * Collects the photos used so the item can credit them.
 */
export function compileTree(tree, ctx) {
  const used = ctx.images
  const visit = (value, key) => {
    if (Array.isArray(value)) {
      const out = []
      for (const item of value) {
        if (item && typeof item === 'object' && typeof item.$section === 'string') {
          const src = ctx.sources.get(item.$section)
          if (!src) throw new Error(`${ctx.slug}: unknown $section "${item.$section}"`)
          if (src.data.meta.kind !== 'section') throw new Error(`${ctx.slug}: $section "${item.$section}" is not a section`)
          if (ctx.stack.includes(item.$section)) throw new Error(`${ctx.slug}: $section loop at "${item.$section}"`)
          ctx.stack.push(item.$section)
          ctx.sections.push(item.$section)
          out.push(...visit(structuredClone(src.data.tree)))
          ctx.stack.pop()
        } else out.push(visit(item))
      }
      return out
    }
    if (value && typeof value === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(value)) out[k] = visit(v, k)
      if (out.blockType === 'element' && out.elementType === 'text-editor' && out.props && typeof out.props.content === 'string') {
        out.props.content = toLexical(out.props.content)
      }
      return out
    }
    if (typeof value === 'string') {
      const img = value.match(IMG_RE)
      if (img) {
        const url = imageUrl(img[1], img[2] ? Number(img[2]) : undefined)
        if (!url) throw new Error(`${ctx.slug}: unknown image id "${img[1]}" (see taxonomy/images.json)`)
        used.add(img[1])
        const alt = img[3]
        return alt !== undefined && key !== 'bgImageUrl' && key !== 'bgVideoPoster' ? { url, alt } : url
      }
      if (value.includes('{{')) {
        const whole = value.match(/^\{\{\s*([a-zA-Z0-9.]+)\s*\}\}$/)
        if (whole) {
          const v = tokenValue(ctx.style, whole[1])
          if (v === undefined) throw new Error(`${ctx.slug}: unknown token ${value}`)
          return v
        }
        return value.replace(TOKEN_RE, (m, path) => {
          const v = tokenValue(ctx.style, path)
          if (v === undefined) throw new Error(`${ctx.slug}: unknown token ${m}`)
          return String(v)
        })
      }
    }
    return value
  }
  return visit(tree)
}

/* ---------------------------------------------------------------- validate */

// Mirrors gracengatsby src/features/templateRepos/manifest.ts + sanitize.ts.
const DENIED_TYPES = new Set(['html', 'rawhtml', 'customhtml', 'htmlembed', 'code', 'customcode', 'customscript', 'script', 'scripts', 'embed', 'iframe', 'frame', 'object', 'shortcode', 'php', 'style', 'headscripts', 'bodyscripts'])
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'dangerouslySetInnerHTML'])
const DANGEROUS_TEXT = /<script|<iframe|<object|<embed|javascript:|data:text\/html|vbscript:/i
const TYPE_KEYS = ['blockType', 'type', 'elementType']
const isDenied = (t) => DENIED_TYPES.has(String(t).toLowerCase().replace(/[-_\s]/g, ''))
const MEDIA_KEYS = {
  image: ['image'], 'image-box': ['image'], 'image-gallery': ['images'], 'image-carousel': ['images'], 'logo-strip': ['images'],
  gallery: ['images'], testimonial: ['photo'], 'team-member': ['photo'], 'flip-box': ['image'], card: ['image'],
  'image-comparison': ['before', 'after'], hotspots: ['image'], video: ['video', 'poster'],
}

export function validateItem(item, { slug, kind }) {
  const errors = []
  const warnings = []
  const err = (m) => errors.push(`${slug}: ${m}`)
  const warn = (m) => warnings.push(`${slug}: ${m}`)

  if (item.format !== 'engage-template') err('format must be "engage-template"')
  if (item.schemaVersion !== 1) err('schemaVersion must be 1')
  if (item.kind !== kind) err(`kind "${item.kind}" does not match library kind "${kind}"`)
  if (!Array.isArray(item.tree) || item.tree.length === 0) err('tree must be a non-empty list')

  let nodes = 0
  const elements = new Map(reference.elements.map((e) => [e.type, e]))
  const blocks = new Set(reference.blocks.map((b) => b.slug))

  const checkValue = (v, path, depth) => {
    if (depth > 64) return err(`${path}: nested too deep`)
    if (typeof v === 'string') {
      if (DANGEROUS_TEXT.test(v)) err(`${path}: text contains script/frame content`)
      if (v.includes('{{')) err(`${path}: unresolved token ${v}`)
      if (/^img:/.test(v)) err(`${path}: unresolved image ${v}`)
      return
    }
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return
    if (Array.isArray(v)) return v.forEach((x, i) => checkValue(x, `${path}[${i}]`, depth + 1))
    if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (FORBIDDEN_KEYS.has(k)) err(`${path}: forbidden key "${k}"`)
        if (TYPE_KEYS.includes(k) && typeof x === 'string' && isDenied(x)) err(`${path}: forbidden type "${x}"`)
        checkValue(x, `${path}.${k}`, depth + 1)
      }
      return
    }
    err(`${path}: value is not plain JSON`)
  }

  const checkNode = (node, path, depth) => {
    nodes++
    if (depth > 24) return err(`${path}: deeper than 24 levels`)
    if (!node || typeof node !== 'object' || Array.isArray(node)) return err(`${path}: node must be an object`)
    const type = node.blockType ?? node.type ?? node.elementType
    if (typeof type !== 'string' || !type || type.length > 80) return err(`${path}: node needs a blockType`)
    if (isDenied(type) || (node.elementType && isDenied(node.elementType))) err(`${path}: forbidden type "${type}"`)
    if ('_id' in node) warn(`${path}: _id should be omitted (the editor assigns ids)`)
    const checkDesign = (design, at) => {
      if (design === undefined) return
      if (!design || typeof design !== 'object' || Array.isArray(design)) return err(`${at}: design must be an object`)
      for (const k of Object.keys(design)) if (!reference.designKeys.has(k)) err(`${at}: unknown design key "${k}" (see reference/design-keys.json)`)
    }
    checkDesign(node.design, `${path}.design`)
    for (const [ci, col] of (node.columns || []).entries()) checkDesign(col.design, `${path}.columns[${ci}].design`)
    if (!blocks.has(node.blockType)) err(`${path}: unknown blockType "${node.blockType}"`)
    if (node.blockType === 'section') {
      if (!Array.isArray(node.columns) || node.columns.length === 0) err(`${path}: section needs columns`)
      ;(node.columns || []).forEach((col, ci) => {
        if ('_id' in col) warn(`${path}.columns[${ci}]: _id should be omitted`)
        if (col.width !== undefined && ![12, 9, 8, 6, 4, 3].includes(col.width)) err(`${path}.columns[${ci}]: width must be 12|9|8|6|4|3`)
        ;(col.blocks || []).forEach((b, bi) => checkNode(b, `${path}.columns[${ci}].blocks[${bi}]`, depth + 2))
      })
    }
    if (node.blockType === 'element') {
      const def = elements.get(node.elementType)
      if (!def) err(`${path}: unknown elementType "${node.elementType}"`)
      else {
        if (def.hidden) warn(`${path}: "${node.elementType}" is retired from the element picker (still renders)`)
        const props = node.props ?? {}
        if (typeof props !== 'object' || Array.isArray(props)) err(`${path}: props must be an object`)
        for (const field of def.fields || []) {
          const v = props[field.name]
          if (v === undefined || !Array.isArray(field.options) || field.type !== 'select') continue
          const allowed = field.options.map((o) => (typeof o === 'object' ? o.value : o))
          if (!allowed.includes(v)) err(`${path}: ${node.elementType}.${field.name} = ${JSON.stringify(v)} not in ${JSON.stringify(allowed)}`)
        }
        for (const key of MEDIA_KEYS[node.elementType] || []) {
          const v = props[key]
          const one = (m) => (typeof m === 'string' ? m : m?.url)
          const list = Array.isArray(v) ? v : v === undefined ? [] : [v]
          for (const m of list) if (typeof one(m) !== 'string' || !/^(https:\/\/|\/)/.test(one(m))) err(`${path}: ${key} must be an https URL or {url, alt}`)
        }
      }
    }
  }

  ;(item.tree || []).forEach((n, i) => checkNode(n, `tree[${i}]`, 1))
  if (nodes > 5000) err(`more than 5000 nodes (${nodes})`)
  checkValue(item.tree, 'tree', 0)
  if (item.assets !== undefined && (!Array.isArray(item.assets) || item.assets.length > 20)) err('assets must be a list of up to 20')
  if (item.requires !== undefined && (typeof item.requires !== 'object' || Object.keys(item.requires).length > 50)) err('requires must be an object of up to 50 keys')
  const bytes = Buffer.byteLength(JSON.stringify(item))
  if (bytes > 1024 * 1024) err(`item file is ${bytes} bytes (limit 1 MB)`)
  return { errors, warnings, nodes }
}

export function validateMeta(meta, file) {
  const errors = []
  const err = (m) => errors.push(`${file}: ${m}`)
  if (!meta || typeof meta !== 'object') return [`${file}: missing "meta"`]
  if (!SLUG_RE.test(meta.slug || '')) err('meta.slug must match ^[a-z0-9][a-z0-9-]{0,63}$')
  if (meta.kind !== 'section' && meta.kind !== 'page') err('meta.kind must be "section" or "page"')
  if (typeof meta.title !== 'string' || !meta.title.trim() || meta.title.length > 120) err('meta.title must be 1-120 characters')
  if (!categoryById(meta.kind, meta.category)) err(`meta.category "${meta.category}" is not a ${meta.kind} category in taxonomy/categories.json`)
  if (typeof meta.description !== 'string' || meta.description.length < 10 || meta.description.length > 300) err('meta.description must be 10-300 characters')
  if (!Array.isArray(meta.tags) || meta.tags.length < 1 || meta.tags.length > 10) err('meta.tags must hold 1-10 tags')
  else for (const t of meta.tags) if (typeof t !== 'string' || !/^[a-z0-9][a-z0-9 -]{0,39}$/.test(t)) err(`tag "${t}" must be lower case, up to 40 characters`)
  if (!styleById(meta.style)) err(`meta.style "${meta.style}" is not in taxonomy/styles.json`)
  if (!Array.isArray(meta.industry) || meta.industry.length < 1) err('meta.industry must list at least one industry')
  else for (const i of meta.industry) if (!taxonomy.categories.industries.includes(i)) err(`industry "${i}" is not in taxonomy/categories.json`)
  if (!Array.isArray(meta.frameworks) || meta.frameworks.some((f) => !FRAMEWORKS.includes(f))) err('meta.frameworks must list "shine" and/or "effix"')
  return errors
}
