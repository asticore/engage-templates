#!/usr/bin/env node
// Renders previews/<slug>.png for every library item: an APPROXIMATE static HTML rendering of the
// item's tree (scripts/render-html.mjs), screenshotted at 1280 px and downscaled to 640 px wide.
//
// Usage: node scripts/previews.mjs [slug ...]   render the given slugs (default: every item)
//        node scripts/previews.mjs --changed    skip items whose PNG is newer than the item JSON
//        node scripts/previews.mjs --html       also write previews/<slug>.html (for debugging; not committed)
// Requires Playwright (resolved globally); never runs `playwright install`.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { ROOT } from './lib.mjs'
import { fontsUrl, renderItem } from './render-html.mjs'

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  // global install (NODE_PATH not set): resolve from npm's global root
  const { execSync } = await import('node:child_process')
  const root = execSync('npm root -g').toString().trim()
  ;({ chromium } = createRequire(join(root, 'noop.js'))('playwright'))
}

const WIDTH = 1280, OUT_WIDTH = 640
const MAX_PAGE_HEIGHT = Math.round(WIDTH * 2.5) // pages are clipped to this before downscale
const MAX_BYTES = 2 * 1024 * 1024

const args = process.argv.slice(2)
const CHANGED = args.includes('--changed')
const HTML = args.includes('--html')
const wanted = new Set(args.filter((a) => !a.startsWith('--')))

const library = JSON.parse(readFileSync(join(ROOT, 'library.json'), 'utf8'))
const items = library.items.filter((it) => !wanted.size || wanted.has(it.slug))
for (const s of wanted) if (!library.items.some((it) => it.slug === s)) console.warn(`! unknown slug: ${s}`)
mkdirSync(join(ROOT, 'previews'), { recursive: true })

const launchOpts = { args: ['--font-render-hinting=none'] }
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
if (proxy) launchOpts.proxy = { server: proxy, bypass: process.env.NO_PROXY || process.env.no_proxy || undefined }
const browser = await chromium.launch(launchOpts)
const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: false })

// Probe Google Fonts once; when blocked or slow, render with system font fallbacks only.
let withFonts = false
try {
  const res = await context.request.get(fontsUrl, { timeout: 5000, headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' } })
  withFonts = res.ok()
} catch {}
console.log(`Google Fonts ${withFonts ? 'reachable' : 'unavailable: using system fonts'}`)

const page = await context.newPage()
const scaler = await context.newPage()
let done = 0, skipped = 0, failed = 0

for (const it of items) {
  const src = join(ROOT, it.file)
  const out = join(ROOT, 'previews', `${it.slug}.png`)
  if (CHANGED && existsSync(out) && statSync(out).mtimeMs > statSync(src).mtimeMs) {
    skipped++
    continue
  }
  try {
    const item = JSON.parse(readFileSync(src, 'utf8'))
    const html = renderItem(item, { withFonts })
    if (HTML) writeFileSync(out.replace(/\.png$/, '.html'), html)
    await page.setViewportSize({ width: WIDTH, height: 900 })
    // 'load' waits for images and fonts; continue on timeout so one slow image never hangs the run
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => console.warn(`  ${it.slug}: load timeout, continuing`))
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.waitForTimeout(150)
    const fullH = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height))
    const h = Math.max(1, it.kind === 'page' ? Math.min(fullH, MAX_PAGE_HEIGHT) : fullH)
    const shot = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: WIDTH, height: h } })

    // Downscale: draw the 1280 px shot into a 640 px <img> and screenshot that.
    const outH = Math.round((h * OUT_WIDTH) / WIDTH)
    await scaler.setViewportSize({ width: OUT_WIDTH, height: Math.max(1, Math.min(outH, 8000)) })
    await scaler.setContent(`<html><body style="margin:0"><img id="i" style="display:block;width:${OUT_WIDTH}px;height:${outH}px" src="data:image/png;base64,${shot.toString('base64')}"></body></html>`, { waitUntil: 'load' })
    const png = await scaler.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: OUT_WIDTH, height: outH } })
    writeFileSync(out, png)
    const kb = Math.round(png.length / 1024)
    if (png.length > MAX_BYTES) console.warn(`! ${it.slug}: ${kb} KB exceeds 2 MB`)
    console.log(`✓ ${it.slug.padEnd(40)} ${OUT_WIDTH}x${outH} ${kb} KB`)
    done++
  } catch (e) {
    failed++
    console.error(`✗ ${it.slug}: ${e.message}`)
  }
}

await browser.close()
console.log(`${done} rendered, ${skipped} unchanged, ${failed} failed`)
process.exit(failed ? 1 : 0)
