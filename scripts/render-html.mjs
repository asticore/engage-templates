// Approximate static HTML renderer for engage-template trees (used only for preview thumbnails).
// It is NOT the builder's renderer: it maps the documented design keys / element props to plain
// HTML + CSS at desktop width, rendering the final state (no motion, no interaction).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.mjs'

const STYLES = JSON.parse(readFileSync(join(ROOT, 'taxonomy/styles.json'), 'utf8')).styles

/* Font keys -> CSS stack (loaded from Google Fonts when reachable, system fallback otherwise). */
const FONTS = {
  inter: ['Inter', 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'],
  montserrat: ['Montserrat', 'system-ui,"Segoe UI",Arial,sans-serif'],
  jost: ['Jost', 'system-ui,"Segoe UI",Arial,sans-serif'],
  playfair: ['Playfair Display', 'Georgia,"Times New Roman",serif'],
  cormorant: ['Cormorant Garamond', 'Georgia,"Times New Roman",serif'],
  cinzel: ['Cinzel', 'Georgia,"Times New Roman",serif'],
}
export const fontsUrl =
  'https://fonts.googleapis.com/css2?' +
  ['Inter:wght@400;500;600;700;800', 'Montserrat:wght@400;500;600;700;800', 'Jost:wght@400;500;600;700',
    'Playfair+Display:wght@400;500;600;700', 'Cormorant+Garamond:wght@400;500;600;700', 'Cinzel:wght@400;500;600;700']
    .map((f) => 'family=' + f).join('&') + '&display=swap'
const fontStack = (k) => {
  if (!k) return null
  const m = String(k).match(/^(?:var\(--(?:eg-)?font-)?([a-z]+)\)?$/)
  const f = FONTS[m ? m[1] : k]
  return f ? `'${f[0]}',${f[1].replace(/"/g, "'")}` : null
}

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
const len = (v, u) => `${v}${u || 'px'}`
const urlOf = (m) => (!m ? '' : typeof m === 'string' ? m : m.url || '')
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean)
// theme tokens (var(--eg-c-primary)) -> concrete colours for the current item style
let CTX = { c: STYLES[0].colors, primary: '#4f46e5', radius: 12 }
const color = (c) => {
  if (!c) return c
  const m = String(c).match(/var\(--(?:eg-c|sh|color)-([\w-]+)/)
  return m && CTX.c[m[1]] ? CTX.c[m[1]] : c
}
const shadows = { sm: '0 1px 3px rgba(0,0,0,.12)', md: '0 6px 18px rgba(0,0,0,.14)', lg: '0 14px 36px rgba(0,0,0,.18)' }
const ph = (label) => `<div class="ph">${esc(label)}</div>`

/* ------------------------------------------------------------------ design -> CSS */
/** Maps a flat design object to CSS declarations. `opts.skipBox` leaves spacing out (sections handle it). */
function css(d = {}, opts = {}) {
  const o = []
  const sides = (pre, unit) => {
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      const v = d[pre + s]
      if (typeof v === 'number') o.push(`${pre}-${s.toLowerCase()}:${len(v, unit)}`)
    }
  }
  sides('padding', d.paddingUnit)
  sides('margin', d.marginUnit)
  if (num(d.minHeight)) o.push(`min-height:${len(d.minHeight, d.minHeightUnit === 'vh' ? 'vh' : d.minHeightUnit)}`)
  if (d.textColor) o.push(`color:${color(d.textColor)}`)
  const ff = fontStack(d.fontFamily)
  if (ff) o.push(`font-family:${ff}`)
  if (d.fontSize) o.push(`font-size:${len(d.fontSize, d.fontSizeUnit)}`)
  if (d.fontWeight) o.push(`font-weight:${d.fontWeight}`)
  if (d.lineHeight) o.push(`line-height:${d.lineHeight}`)
  if (typeof d.letterSpacing === 'number') o.push(`letter-spacing:${len(d.letterSpacing, d.letterSpacingUnit)}`)
  if (d.textTransform) o.push(`text-transform:${d.textTransform}`)
  if (d.textAlign) o.push(`text-align:${d.textAlign}`)
  if (d.fontStyle) o.push(`font-style:${d.fontStyle}`)
  if (d.textDecoration) o.push(`text-decoration:${d.textDecoration}`)
  // radius (per-corner overrides fall back to borderRadius)
  const r = [d.radiusTl, d.radiusTr, d.radiusBr, d.radiusBl].map((v) => (typeof v === 'number' ? v : d.borderRadius))
  if (r.some((v) => typeof v === 'number')) o.push(`border-radius:${r.map((v) => num(v) + 'px').join(' ')}`, 'overflow:hidden')
  if (num(d.borderWidth)) o.push(`border:${d.borderWidth}px ${d.borderStyle || 'solid'} ${color(d.borderColor) || 'currentColor'}`)
  if (shadows[d.boxShadow]) o.push(`box-shadow:${shadows[d.boxShadow]}`)
  if (d.glass) o.push(`background:rgba(255,255,255,${num(d.glassOpacity, 12) > 1 ? num(d.glassOpacity) / 100 : num(d.glassOpacity, 0.12)})`, `backdrop-filter:blur(${num(d.glassBlur, 12)}px)`, 'border:1px solid rgba(255,255,255,.25)')
  if (typeof d.opacity === 'number' && d.opacity < 100) o.push(`opacity:${d.opacity / 100}`)
  if (d.maskShape === 'circle') o.push('clip-path:circle(50%)')
  if (d.maskShape === 'rounded') o.push('border-radius:32px;overflow:hidden')
  // background
  if (!d.glass) {
    if (d.bgType === 'color' && d.bgColor) o.push(`background-color:${color(d.bgColor)}`)
    else if (d.bgType === 'gradient') o.push(`background:linear-gradient(${num(d.bgGradientAngle, 180)}deg,${color(d.bgGradientFrom) || '#fff'},${color(d.bgGradientTo) || '#eee'})`)
    else if ((d.bgType === 'image' || d.bgType === 'slideshow' || d.bgType === 'video') && (d.bgImageUrl || d.bgSlides?.[0] || d.bgVideoPoster))
      o.push(`background:url('${esc(d.bgImageUrl || d.bgSlides?.[0] || d.bgVideoPoster)}') center/cover no-repeat ${d.bgColor || '#334155'}`)
    else if (d.bgColor && !d.bgType) o.push(`background-color:${color(d.bgColor)}`)
  }
  return o.join(';')
}

/** Overlay, bgEffect and divider layers (absolutely positioned children of a block). */
function layers(d = {}) {
  let h = ''
  if (d.overlayType === 'color' || d.overlayType === 'gradient')
    h += `<div class="layer" style="background:${d.overlayType === 'gradient' ? `linear-gradient(${num(d.overlayAngle, 180)}deg,${color(d.overlayColor) || '#000'},${color(d.overlayColor2) || 'transparent'})` : color(d.overlayColor) || '#000'};opacity:${num(d.overlayOpacity, 50) / 100}"></div>`
  else if (num(d.bgOverlay) && d.bgType === 'image') h += `<div class="layer" style="background:#000;opacity:${d.bgOverlay / 100}"></div>`
  const fx = d.bgEffect, c1 = color(d.bgEffectColor) || CTX.primary, c2 = color(d.bgEffectColor2) || CTX.c.secondary, k = num(d.bgEffectIntensity, 50) / 100
  if (fx === 'aurora' || fx === 'mesh' || fx === 'gradient-shift')
    h += `<div class="layer" style="opacity:${0.25 + k * 0.5};background:radial-gradient(40% 50% at 20% 25%,${c1},transparent 70%),radial-gradient(35% 45% at 80% 30%,${c2},transparent 70%),radial-gradient(40% 50% at 55% 90%,${c1},transparent 70%);filter:blur(30px)"></div>`
  else if (fx === 'particles') {
    let dots = ''
    for (let i = 0; i < 28; i++) dots += `<i style="left:${(i * 37 + 11) % 97}%;top:${(i * 53 + 7) % 93}%;width:${3 + (i % 3) * 2}px;height:${3 + (i % 3) * 2}px"></i>`
    h += `<div class="layer particles" style="color:${c1}">${dots}</div>`
  } else if (fx === 'dots') h += `<div class="layer" style="opacity:.35;background-image:radial-gradient(${c1} 1.5px,transparent 1.5px);background-size:${num(d.dotSpacing, 22)}px ${num(d.dotSpacing, 22)}px"></div>`
  else if (fx === 'grid') h += `<div class="layer" style="opacity:.25;background-image:linear-gradient(${c1} 1px,transparent 1px),linear-gradient(90deg,${c1} 1px,transparent 1px);background-size:${num(d.gridSize, 48)}px ${num(d.gridSize, 48)}px"></div>`
  else if (fx === 'grain') h += `<div class="layer" style="opacity:.08;background:repeating-conic-gradient(#000 0 25%,#fff 0 50%) 0 0/3px 3px"></div>`
  for (const pos of ['Top', 'Bottom']) {
    const shape = d['divider' + pos]
    if (!shape || shape === 'none') continue
    const hgt = num(d[`divider${pos}Height`], 60), col = color(d[`divider${pos}Color`]) || '#fff'
    const paths = {
      wave: 'M0 60 C200 0 400 120 600 60 S1000 0 1200 60 V120 H0Z', waves: 'M0 70 C150 20 300 110 450 60 S750 10 900 60 S1100 100 1200 50 V120 H0Z',
      tilt: 'M0 120 L1200 0 V120Z', slant: 'M0 120 L1200 0 V120Z', curve: 'M0 120 Q600 -40 1200 120Z', 'curve-asym': 'M0 120 Q400 -20 1200 100 V120Z',
      triangle: 'M0 120 H520 L600 20 L680 120 H1200 V120Z', arrow: 'M0 120 H540 L600 40 L660 120 H1200Z', zigzag: 'M0 120 L100 50 L200 120 L300 50 L400 120 L500 50 L600 120 L700 50 L800 120 L900 50 L1000 120 L1100 50 L1200 120Z',
    }
    const p = paths[shape] || paths.wave, flip = d[`divider${pos}Flip`] ? 'scaleX(-1)' : ''
    // base shape sits at the bottom edge; top dividers are rotated 180deg
    h += `<svg class="div" viewBox="0 0 1200 120" preserveAspectRatio="none" style="${pos === 'Top' ? 'top:-1px' : 'bottom:-1px'};height:${hgt}px;transform:${pos === 'Top' ? 'rotate(180deg) ' : ''}${flip}"><path d="${p}" fill="${col}"/></svg>`
  }
  return h
}

/* ------------------------------------------------------------------ icons */
const ICONS = {
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z"/>',
  heart: '<path d="M12 20s-8-4.9-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6.100-8 11-8 11z"/>',
  check: '<path d="M4 12.5l5 5L20 6.500"/>', arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M6 3h4l2 5-2.500 1.500a11 11 0 005 5L16 12l5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z"/>',
  pin: '<path d="M12 21s7-6.200 7-11.500a7 7 0 00-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8c-3 0-5-1-4-3s4 0 4 3zm0 0c3 0 5-1 4-3s-4 0-4 3z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM18 16l.8 2.200L21 19l-2.200.8L18 22l-.8-2.200L15 19l2.200-.8z"/>',
  truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.500" r="1.800"/><circle cx="17" cy="17.500" r="1.800"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.1"/>', home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
}
const icon = (name, size = 32, col = 'currentColor') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${ICONS[(name && name.icon) || name] || ICONS.star}</svg>`

/* ------------------------------------------------------------------ rich text (Lexical JSON) */
function lexical(node) {
  if (!node) return ''
  const kids = (node.children || []).map(lexical).join('')
  switch (node.type) {
    case 'root': return kids
    case 'paragraph': return `<p>${kids || '&nbsp;'}</p>`
    case 'heading': return `<${node.tag || 'h3'}>${kids}</${node.tag || 'h3'}>`
    case 'quote': return `<blockquote>${kids}</blockquote>`
    case 'list': { const t = node.listType === 'number' ? 'ol' : 'ul'; return `<${t}>${kids}</${t}>` }
    case 'listitem': return `<li>${kids}</li>`
    case 'linebreak': return '<br>'
    case 'link': case 'autolink': return `<a>${kids}</a>`
    case 'text': {
      let t = esc(node.text), f = node.format || 0
      if (f & 1) t = `<strong>${t}</strong>`
      if (f & 2) t = `<em>${t}</em>`
      if (f & 4) t = `<s>${t}</s>`
      if (f & 8) t = `<u>${t}</u>`
      return t
    }
    default: return kids
  }
}

/* ------------------------------------------------------------------ elements */
const HSIZE = { h1: 48, h2: 36, h3: 28, h4: 22, h5: 18, h6: 15 }
const al = (a) => (a ? `text-align:${a === 'centre' ? 'center' : a}` : '')
const flexAl = (a) => `display:flex;justify-content:${{ center: 'center', centre: 'center', right: 'flex-end' }[a] || 'flex-start'}`
const heading = (text, tag = 'h2', d = {}, extra = '') =>
  `<${tag} class="h" style="${extra}font-size:${d.fontSize ? 'inherit' : HSIZE[tag] + 'px'};font-weight:${d.fontWeight ? 'inherit' : 700}">${esc(text)}</${tag}>`
const btn = (text, variant = 'primary', size = 'md') => {
  const pad = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' }[size] || '12px 24px'
  const fs = { sm: 14, md: 16, lg: 18 }[size] || 16
  const p = CTX.primary, on = CTX.c.onPrimary || '#fff'
  // secondary inherits the surrounding text colour so it stays readable on dark and photo bands
  const st = variant === 'secondary' ? 'border:2px solid currentColor;color:inherit;background:transparent'
    : variant === 'plain' ? `color:${p};background:transparent;padding-left:0;padding-right:0;text-decoration:underline`
    : `background:${p};color:${on};border:2px solid ${p}`
  return `<span class="btn" style="padding:${pad};font-size:${fs}px;${st}">${esc(text)}</span>`
}
const imgBox = (src, ratio = 'auto', fit = 'cover', extra = '') => {
  const ar = /^\d+:\d+$/.test(ratio) ? `aspect-ratio:${ratio.replace(':', '/')};` : ''
  return src ? `<img src="${esc(src)}" style="width:100%;${ar}object-fit:${fit};display:block;${ar ? 'height:auto;' : ''}${extra}">`
    : `<div class="imgph" style="${ar || 'aspect-ratio:16/10;'}${extra}"></div>`
}
const stars = (n, max = 5, col = '#f59e0b') => `<span style="color:${col};letter-spacing:2px;font-size:18px">${'★'.repeat(Math.round(n))}<span style="opacity:.25">${'★'.repeat(Math.max(0, max - Math.round(n)))}</span></span>`
const faux = (n = 3, mk) => Array.from({ length: n }, (_, i) => mk(i)).join('')
const cardBox = (inner, p = {}) => `<div class="card" style="background:${color(p.bgColour) || CTX.c.surface || '#fff'};border-radius:${num(p.borderRadius, CTX.radius)}px;box-shadow:${shadows[p.shadow] || 'none'};${al(p.align)}">${inner}</div>`
const pill = (t) => `<span class="field">${esc(t)}</span>`

const E = {
  heading: (p, d) => heading(p.text, p.tag, d, al(p.align) + ';'),
  'text-editor': (p) => `<div class="rt" style="${al(p.align)}">${lexical(p.content?.root)}</div>`,
  button: (p) => `<div style="${flexAl(p.align)}">${btn(p.text || 'Learn more', p.variant, p.size)}</div>`,
  image: (p) => `<figure style="margin:0;${flexAl(p.align)};flex-direction:column;align-items:${p.align === 'center' ? 'center' : p.align === 'right' ? 'flex-end' : 'flex-start'}"><div style="width:${num(p.width, 100)}%">${imgBox(urlOf(p.image) || p.url, p.ratio, p.fit)}</div>${p.caption ? `<figcaption class="muted">${esc(p.caption)}</figcaption>` : ''}</figure>`,
  card: (p) => cardBox(`${p.media === 'image' ? imgBox(urlOf(p.image), p.imageRatio === 'auto' ? '16:10' : p.imageRatio, p.imageFit) : ''}<div style="padding:20px">${p.media === 'icon' ? `<div style="color:${CTX.primary};margin-bottom:12px">${icon(p.icon, 36)}</div>` : ''}${heading(p.title, p.titleTag || 'h3').replace('font-size:28px', 'font-size:20px')}<p class="muted" style="margin:8px 0 0">${esc(p.text)}</p>${p.linkLabel ? `<p style="margin:12px 0 0;color:${CTX.primary};font-weight:600">${esc(p.linkLabel)} →</p>` : ''}</div>`, p),
  icon: (p) => `<div style="${flexAl(p.align)};flex-direction:column;align-items:${p.align === 'center' ? 'center' : 'flex-start'};color:${CTX.primary}">${icon(p.icon, num(p.size, 48))}${p.label ? `<span style="color:inherit;font-size:14px;margin-top:6px">${esc(p.label)}</span>` : ''}</div>`,
  'icon-box': (p) => `<div style="display:flex;gap:16px;flex-direction:${p.layout === 'left' ? 'row' : 'column'};align-items:${p.layout === 'left' ? 'flex-start' : p.align === 'center' ? 'center' : 'flex-start'};${al(p.align)}"><div style="color:${CTX.primary}">${icon(p.icon, num(p.size, 40))}</div><div>${heading(p.title, p.tag === 'p' ? 'h4' : p.tag || 'h3').replace(/font-size:\d+px/, 'font-size:20px')}<p class="muted" style="margin:6px 0 0">${esc(p.text)}</p></div></div>`,
  list: (p) => `<ul class="ul" style="${al(p.align)}">${(p.items || []).map((it, i) => `<li style="margin-bottom:${num(p.gap, 8)}px">${p.marker === 'none' ? '' : ['bullets', 'numbers', undefined].includes(p.marker) || !p.marker ? `<b style="min-width:18px;color:${color(p.iconColour) || CTX.primary}">${p.marker === 'numbers' ? i + 1 + '.' : '•'}</b>` : `<b style="color:${color(p.iconColour) || CTX.primary}">${{ check: '✓', arrow: '→', dash: '–', icon: '✓' }[p.marker] ?? '•'}</b>`}<span>${esc(it.text)}</span></li>`).join('')}</ul>`,
  'icon-list': (p) => `<ul class="ul" style="${p.layout === 'inline' ? 'flex-direction:row;gap:24px;flex-wrap:wrap;' : ''}${flexAl(p.align)}">${(p.items || []).map((it) => `<li style="gap:10px"><span style="color:${CTX.primary};display:flex">${icon(p.icon || 'check', 20)}</span><span>${esc(it.text)}</span></li>`).join('')}</ul>`,
  counter: (p, d) => `<div style="${al(p.align || 'center')}"><div class="big"${d.fontSize ? ' style="font-size:inherit"' : ''}>${esc(p.prefix)}${Number(p.number ?? 0).toLocaleString('en-US', { useGrouping: !!p.separator, minimumFractionDigits: num(p.decimals), maximumFractionDigits: num(p.decimals) })}${esc(p.suffix)}</div><div class="muted lbl">${esc(p.title)}</div></div>`,
  'count-up': (p, d) => `<div style="text-align:center"><div class="big"${d.fontSize ? ' style="font-size:inherit"' : ''}>${esc(p.prefix)}${Number(p.end ?? 0).toFixed(Number(p.decimals) || 0)}${esc(p.suffix)}</div><div class="muted lbl">${esc(p.label)}</div></div>`,
  'pricing-table': (p) => `<div class="card" style="padding:32px 28px;text-align:center;background:${p.highlight ? CTX.primary : CTX.c.surface || '#fff'};color:${p.highlight ? CTX.c.onPrimary || '#fff' : 'inherit'};border:${p.highlight ? 0 : '1px'} solid ${CTX.c.border || '#e5e7eb'};box-shadow:${p.highlight ? shadows.lg : 'none'};border-radius:${CTX.radius}px;position:relative">${p.ribbon ? `<span style="position:absolute;top:12px;right:12px;background:${CTX.c.accent || '#f59e0b'};color:#111;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px">${esc(p.ribbon)}</span>` : ''}<h3 class="h" style="font-size:20px">${esc(p.title)}</h3><div style="margin:16px 0"><span style="font-size:48px;font-weight:800">${esc(p.currency)}${esc(p.price)}</span> <span style="opacity:.7">${esc(p.period)}</span></div><ul class="ul" style="text-align:left;margin-bottom:24px">${(p.features || []).map((f) => `<li style="margin-bottom:8px;gap:10px;opacity:${f.included === false ? 0.4 : 1}"><b>${f.included === false ? '×' : '✓'}</b><span>${esc(f.text)}</span></li>`).join('')}</ul><span class="btn" style="display:block;padding:12px;${p.highlight ? `background:${CTX.c.onPrimary || '#fff'};color:${CTX.primary}` : `background:${CTX.primary};color:${CTX.c.onPrimary || '#fff'}`}">${esc(p.buttonText || 'Choose')}</span></div>`,
  testimonial: (p) => `<div style="${al(p.align)}">${p.stars ? `<div style="margin-bottom:12px">${stars(p.stars)}</div>` : ''}<p style="font-size:1.15em;margin:0 0 16px;line-height:1.5">“${esc(p.quote)}”</p><div style="display:flex;gap:12px;align-items:center;justify-content:${p.align === 'center' ? 'center' : 'flex-start'}">${urlOf(p.photo) ? `<img src="${esc(urlOf(p.photo))}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : ''}<div style="text-align:left"><b>${esc(p.name)}</b><div class="muted" style="font-size:14px">${esc(p.role)}</div></div></div></div>`,
  'team-member': (p) => `<div style="${al(p.align || 'center')}">${imgBox(urlOf(p.photo), '1:1', 'cover', `border-radius:${CTX.radius}px`)}<h4 class="h" style="font-size:20px;margin-top:14px">${esc(p.name)}</h4><div style="color:${CTX.primary};font-size:14px;font-weight:600">${esc(p.role)}</div><p class="muted" style="margin:8px 0">${esc(p.bio)}</p></div>`,
  accordion: (p) => `<div class="acc">${(p.items || []).map((it, i) => `<div class="accitem"><div class="acch">${esc(it.heading)}<span>${i === 0 && p.openFirst !== false ? '−' : '+'}</span></div>${i === 0 && p.openFirst !== false ? `<div class="muted" style="padding:0 0 16px">${esc(it.content)}</div>` : ''}</div>`).join('')}</div>`,
  tabs: (p) => `<div><div class="tabbar">${(p.items || []).map((it, i) => `<span class="${i ? '' : 'on'}">${esc(it.title)}</span>`).join('')}</div><p class="muted">${esc(p.items?.[0]?.content)}</p></div>`,
  toggle: (p) => E.accordion({ openFirst: p.openFirst, items: lines(p.items).map((l) => ({ heading: l.split('|')[0], content: l.split('|')[1] })) }),
  'social-icons': (p) => `<div style="${flexAl(p.align)};gap:10px">${(p.items || []).map((it) => `<span style="width:${num(p.size, 20) + 20}px;height:${num(p.size, 20) + 20}px;border-radius:${p.shape === 'square' ? 6 : 50}%;background:${p.shape === 'plain' ? 'transparent' : CTX.primary};color:${p.shape === 'plain' ? CTX.primary : CTX.c.onPrimary || '#fff'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${num(p.size, 20) * 0.7}px">${esc((it.network || '?')[0].toUpperCase())}</span>`).join('')}</div>`,
  'nav-menu': (p) => `<nav style="display:flex;gap:${p.layout === 'vertical' ? 10 : 28}px;flex-direction:${p.layout === 'vertical' ? 'column' : 'row'};font-weight:500">${['Home', 'Features', 'Pricing', 'Contact'].map((t) => `<span>${t}</span>`).join('')}</nav>`,
  'site-logo': () => `<div class="logo"><span style="background:${CTX.primary};width:28px;height:28px;border-radius:8px;display:inline-block"></span>Brand</div>`,
  'site-title': () => `<div class="logo">Brand</div>`,
  map: () => `<div class="imgph" style="min-height:280px;display:flex;align-items:center;justify-content:center;border-radius:${CTX.radius}px;color:#64748b">${icon('pin', 44, CTX.primary)}</div>`,
  'post-list': () => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${faux(3, (i) => cardBox(`${imgBox('', '16:10')}<div style="padding:16px"><h4 class="h" style="font-size:18px">Post title ${i + 1}</h4><p class="muted" style="margin:6px 0 0;font-size:14px">A short excerpt of the post appears here.</p></div>`))}</div>`,
  'price-list': (p) => `<div>${(p.items || []).map((it) => `<div style="display:flex;gap:12px;align-items:baseline;padding:10px 0;border-bottom:1px dashed ${CTX.c.border || '#ddd'}"><div style="flex:1"><b>${esc(it.name)}</b><div class="muted" style="font-size:14px">${esc(it.description)}</div></div><b>${esc(it.price)}</b></div>`).join('')}</div>`,
  'logo-strip': (p) => `<div style="display:flex;gap:40px;align-items:center;justify-content:center;flex-wrap:wrap;opacity:.65">${(p.items || []).map((it, i) => (urlOf(it.image) || it.url ? `<img src="${esc(urlOf(it.image) || it.url)}" style="height:${num(p.height, 40)}px;${p.grayscale === false ? '' : 'filter:grayscale(1)'}">` : `<b style="font-size:20px;letter-spacing:1px">${esc(it.alt || 'LOGO ' + (i + 1))}</b>`)).join('')}</div>`,
  'image-gallery': (p) => {
    const imgs = (p.images || []).map(urlOf).filter(Boolean).concat(lines(p.urls).map((l) => l.split('|')[0].trim()))
    const n = imgs.length || 6
    return `<div style="display:grid;grid-template-columns:repeat(${num(p.columns, 3)},1fr);gap:${num(p.gap, 12)}px">${faux(n, (i) => imgBox(imgs[i], p.ratio || '1:1', p.fit))}</div>`
  },
  'business-hours': (p) => `<div>${p.title ? `<h4 class="h" style="font-size:20px;margin-bottom:10px">${esc(p.title)}</h4>` : ''}${(p.rows || []).map((r) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${CTX.c.border || '#eee'}"><span style="text-transform:capitalize">${esc(r.day)}</span><span>${r.closed ? 'Closed' : esc(r.open) + ' – ' + esc(r.close)}</span></div>`).join('')}</div>`,
  'star-rating': (p) => `<div style="${al(p.align)}">${p.title ? `<div class="muted">${esc(p.title)}</div>` : ''}${stars(num(p.rating, 5), num(p.scale, 5))}</div>`,
  'call-to-action': (p) => `<div style="${al(p.align || 'center')};padding:40px;border-radius:${CTX.radius}px;background:${p.tone === 'light' ? CTX.c.surface : p.tone === 'dark' ? CTX.c.dark || '#111827' : CTX.primary};color:${p.tone === 'light' ? CTX.c.text : p.tone === 'dark' ? '#fff' : CTX.c.onPrimary || '#fff'}">${heading(p.title, 'h3')}<p style="margin:10px 0 20px;opacity:.85">${esc(p.text)}</p><div style="${flexAl(p.align || 'center')};gap:12px">${p.buttonText ? `<span class="btn" style="background:#fff;color:#111;padding:12px 24px">${esc(p.buttonText)}</span>` : ''}${p.secondText ? `<span class="btn" style="border:2px solid currentColor;padding:10px 22px">${esc(p.secondText)}</span>` : ''}</div></div>`,
  quote: (p) => `<blockquote style="margin:0;padding-left:20px;border-left:4px solid ${CTX.primary};${al(p.align)}"><p style="font-size:1.2em;font-style:italic;margin:0 0 8px">${esc(p.text)}</p><cite class="muted">${esc(p.cite)}</cite></blockquote>`,
  alert: (p) => `<div style="padding:14px 18px;border-radius:8px;background:${CTX.c.surface2 || '#eef'};border-left:4px solid ${CTX.primary}"><b>${esc(p.title)}</b> ${esc(p.text)}</div>`,
  'progress-bar': (p) => `<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span>${esc(p.title)}</span><span>${p.showPercent === false ? '' : num(p.percent) + '%'}</span></div><div style="height:8px;border-radius:9px;background:${CTX.c.border || '#e5e7eb'}"><div style="width:${num(p.percent)}%;height:100%;border-radius:9px;background:${CTX.primary}"></div></div></div>`,
  'image-box': (p) => `<div style="${al(p.align)}">${imgBox(urlOf(p.image) || p.url, '4:3')}<h3 class="h" style="font-size:20px;margin-top:12px">${esc(p.title)}</h3><p class="muted" style="margin:6px 0 0">${esc(p.text)}</p></div>`,
  countdown: () => `<div style="display:flex;gap:16px;justify-content:center">${['Days', 'Hours', 'Mins', 'Secs'].map((u, i) => `<div style="text-align:center;padding:14px 18px;border-radius:10px;background:${CTX.c.surface2 || '#eee'}"><div class="big" style="font-size:36px">${[12, 8, 45, 30][i]}</div><div class="muted" style="font-size:12px">${u}</div></div>`).join('')}</div>`,
  table: (p) => `<table class="tbl">${lines(p.rows).map((r, i) => `<tr>${r.split('|').map((c) => (i === 0 && p.headerRow !== false ? `<th>${esc(c.trim())}</th>` : `<td>${esc(c.trim())}</td>`)).join('')}</tr>`).join('')}</table>`,
  timeline: (p) => `<div style="border-left:2px solid ${CTX.primary};padding-left:20px">${(p.items || []).map((it) => `<div style="margin-bottom:20px"><b style="color:${CTX.primary}">${esc(it.date)}</b><div style="font-weight:700">${esc(it.title)}</div><div class="muted">${esc(it.text)}</div></div>`).join('')}</div>`,
  reviews: (p) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${(p.items || []).map((it) => cardBox(`<div style="padding:18px">${stars(Number(it.rating))}<p style="margin:8px 0">${esc(it.text)}</p><b>${esc(it.name)}</b></div>`)).join('')}</div>`,
  video: () => `<div style="aspect-ratio:16/9;background:#0f172a;border-radius:${CTX.radius}px;display:flex;align-items:center;justify-content:center"><span style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;color:#111;font-size:24px">▶</span></div>`,
  'dual-heading': (p) => `<${p.tag || 'h2'} class="h" style="${al(p.align)};font-size:${HSIZE[p.tag || 'h2']}px">${esc(p.first)} <span style="color:${color(p.color) || CTX.primary}">${esc(p.second)}</span></${p.tag || 'h2'}>`,
  'flip-box': (p) => cardBox(`<div style="padding:32px;text-align:center;min-height:${num(p.height, 220)}px;color:${CTX.primary}">${icon(p.icon, 40)}<h3 class="h" style="font-size:20px;color:${CTX.c.text}">${esc(p.frontTitle)}</h3><p class="muted">${esc(p.frontText)}</p></div>`, p),
  'image-carousel': (p) => `<div style="display:grid;grid-template-columns:repeat(${num(p.visible, 1)},1fr);gap:12px">${faux(num(p.visible, 1), (i) => imgBox(urlOf((p.images || [])[i]), p.ratio || '16:9'))}</div>`,
  'text-ticker': (p) => `<div style="overflow:hidden;white-space:nowrap;font-weight:600">${lines(p.items).join('  •  ')}</div>`,
  breadcrumbs: () => `<div class="muted" style="font-size:14px">Home / Section / Page</div>`,
  'search-box': () => pill('Search…'),
  'share-buttons': () => E['social-icons']({ items: [{ network: 'facebook' }, { network: 'x' }, { network: 'linkedin' }], shape: 'circle' }),
  divider: (p) => `<div style="display:flex;align-items:center;gap:12px;padding:${num(p.gap, 16)}px 0;width:${num(p.width, 100)}%;margin:${p.align === 'center' ? '0 auto' : '0'}">${p.showLine === false ? '' : `<hr style="flex:1;border:0;border-top:${num(p.weight, 1)}px ${p.style || 'solid'} ${CTX.c.border || '#ccc'}">`}${p.label ? `<span class="muted">${esc(p.label)}</span><hr style="flex:1;border:0;border-top:${num(p.weight, 1)}px ${p.style || 'solid'} ${CTX.c.border || '#ccc'}">` : ''}</div>`,
  spacer: (p) => `<div style="height:${num(p.height, 32)}px"></div>`,
}
E['loop-grid'] = E.loop = E['post-list']
E.gallery = E['image-gallery']
for (const k of ['gradient-text', 'highlight-text', 'outline-text', 'split-text', 'animated-headline'])
  E[k] = (p, d) => heading(p.text || [p.before, (p.words || '').split('\n')[0], p.after].filter(Boolean).join(' '), p.tag || 'h2', d)
E['image-accordion'] = E.slides = (p) => E['image-carousel']({ visible: 1, ratio: '21:9' })
const FIELD_TYPES = ['ff-text', 'ff-email', 'ff-phone', 'ff-textarea', 'ff-select', 'ff-number', 'ff-date', 'ff-checkbox', 'ff-radio', 'ff-consent', 'ff-time', 'ff-datetime', 'ff-file']
for (const t of FIELD_TYPES)
  E[t] = (p) => `<div style="margin-bottom:4px"><div style="font-size:14px;font-weight:600;margin-bottom:6px">${esc(p.label || t.slice(3))}</div><div class="field" style="${t === 'ff-textarea' ? 'height:96px' : ''}">${esc(p.placeholder || '')}</div></div>`

/** Renders one element node (wrapper carries the element's own design). */
function element(n) {
  const p = n.props || {}, d = n.design || {}
  let inner
  try {
    inner = E[n.elementType] ? E[n.elementType](p, d) : ph(n.elementType)
  } catch (e) { inner = ph(`${n.elementType} (render error)`) }
  const w = d.selfWidth === 'full' ? 'width:100%;' : d.selfWidth === 'custom' ? `width:${num(d.selfWidthPercent, 100)}%;` : ''
  const as = d.selfAlign ? `align-self:${{ start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch' }[d.selfAlign]};` : ''
  return `<div class="el" style="${w}${as}${css(d)}">${inner}${layers(d)}</div>`
}

/* ------------------------------------------------------------------ sections / columns */
const SIDE = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', between: 'space-between', around: 'space-around', evenly: 'space-evenly' }
const gapOf = (l) => num(l?.gap?.desktop ?? (typeof l?.gap === 'number' ? l.gap : undefined), 16)

/** A column's CSS width inside a row of k columns with gap g. */
function colWidth(c, k, g) {
  const wd = c.widthDesktop || { value: c.width || 12, unit: 'fraction' }
  const share = (f) => `calc((100% - ${(k - 1) * g}px) * ${f})`
  switch (wd.unit) {
    case 'px': return `flex:0 1 ${wd.value}px`
    case 'auto': return 'flex:0 1 auto'
    case 'fill': return 'flex:1 1 0'
    case 'percent': return `flex:0 1 ${share(wd.value / 100)}`
    default: return `flex:0 1 ${share((wd.value || 12) / 12)}`
  }
}

function column(c, extra = '') {
  const l = c.layout || {}, d = c.design || {}
  const pad = l.padding ? `padding:${['top', 'right', 'bottom', 'left'].map((s) => num(l.padding[s]) + 'px').join(' ')};` : ''
  const jc = { top: 'flex-start', middle: 'center', bottom: 'flex-end', between: 'space-between' }[l.vAlign] || 'flex-start'
  const self = l.alignSelf ? `align-self:${SIDE[l.alignSelf]};` : ''
  const body = (c.blocks || []).map(node).join('')
  return `<div class="col" style="${extra};${self}${pad}justify-content:${jc};gap:${num(l.gap, 16)}px;${css(d)}">${body}${layers(d)}</div>`
}

function section(n, nested = false) {
  const d = n.design || {}, l = d.layout || {}, cols = n.columns || []
  const g = gapOf(l), k = cols.length || 1, disp = l.display || 'columns'
  const dir = l.direction?.desktop || 'row'
  const boxed = l.contentWidth !== 'full' && !nested
  let inner
  if (disp === 'grid') {
    const gc = l.gridMinWidth ? `repeat(auto-fit,minmax(${l.gridMinWidth}px,1fr))` : `repeat(${num(l.gridColumns, 3)},minmax(0,1fr))`
    inner = `<div style="display:grid;grid-template-columns:${gc};gap:${num(l.gridGap, 16)}px;align-items:${SIDE[l.gridAlign] || 'stretch'}">${cols.map((c) => column(c)).join('')}</div>`
  } else if (disp === 'carousel') {
    const pv = num(l.carouselPerView, 1), cg = num(l.carouselGap, 16)
    inner = `<div class="carousel" style="display:flex;gap:${cg}px;position:relative">${cols.slice(0, pv).map((c) => column(c, `flex:0 0 calc((100% - ${(pv - 1) * cg}px) / ${pv})`)).join('')}${l.carouselArrows === false ? '' : '<span class="arrow" style="left:8px">‹</span><span class="arrow" style="right:8px">›</span>'}</div>`
  } else if (disp === 'tabs') {
    inner = `<div class="tabbar" style="justify-content:${SIDE[l.tabsAlign] || 'flex-start'}">${cols.map((c, i) => `<span class="${i ? '' : 'on'}" ${i === 0 && l.tabsColor ? `style="border-color:${color(l.tabsColor)}"` : ''}>${esc(c.label || 'Tab ' + (i + 1))}</span>`).join('')}</div>${cols[0] ? column(cols[0]) : ''}`
  } else if (disp === 'accordion') {
    inner = cols.map((c, i) => `<div class="accitem"><div class="acch">${esc(c.label || 'Panel ' + (i + 1))}<span>${i ? '+' : '−'}</span></div>${i ? '' : `<div style="padding-bottom:16px">${column(c)}</div>`}</div>`).join('')
  } else if (disp === 'modal') {
    inner = `<div style="display:flex;justify-content:center">${btn(l.modalLabel || 'Open', 'primary')}</div>`
  } else if (disp === 'sticky-steps') {
    // final-state approximation: step texts stacked on one side, the first step's media pinned on the other
    const isMedia = (b) => b.elementType === 'image' || b.elementType === 'video'
    const media = cols.flatMap((c) => (c.blocks || []).filter(isMedia))[0]
    const steps = cols.map((c) => column({ ...c, blocks: (c.blocks || []).filter((b) => !isMedia(b)) }, 'flex:0 0 auto')).join('')
    const side = `<div style="flex:1 1 0;min-width:0">${media ? node(media) : ''}</div>`
    inner = `<div style="display:flex;gap:${num(l.stickyStepsGap, 48)}px;align-items:flex-start;flex-direction:${l.stickyStepsSide === 'left' ? 'row-reverse' : 'row'}"><div style="flex:1 1 0;display:flex;flex-direction:column;gap:${Math.max(g, 32)}px">${steps}</div>${side}</div>`
  } else if (disp === 'stack' || disp === 'hscroll') {
    inner = disp === 'hscroll'
      ? `<div style="display:flex;gap:${g}px;overflow:hidden">${cols.map((c) => column(c, 'flex:0 0 60%')).join('')}</div>`
      : `<div style="display:flex;flex-direction:column;gap:${g}px">${cols.map((c) => column(c)).join('')}</div>`
  } else {
    const rev = dir.includes('reverse'), vert = dir.startsWith('column')
    const items = vert ? cols.map((c) => column(c, 'flex:0 0 auto;width:100%')) : cols.map((c) => column(c, colWidth(c, k, g)))
    inner = `<div style="display:flex;flex-direction:${dir};flex-wrap:${l.wrap === false ? 'nowrap' : 'wrap'};gap:${g}px;justify-content:${SIDE[l.justify] || 'flex-start'};align-items:${SIDE[l.alignItems] || 'stretch'}">${items.join('')}</div>`
  }
  const bw = boxed ? `max-width:${num(l.boxedWidth, 1200)}px;margin:0 auto;` : ''
  return `<section class="blk" style="${css(d)}${nested ? '' : ';width:100%'}"><div style="position:relative;${bw}">${inner}</div>${layers(d)}</section>`
}

/** The `form` block embeds a CMS form we cannot see: show a generic contact form. */
function formStub(n) {
  const f = (label, h = 44) => `<div style="flex:1"><div style="font-size:14px;font-weight:600;margin-bottom:6px">${label}</div><div class="field" style="height:${h}px"></div></div>`
  return `<div class="el" style="display:flex;flex-direction:column;gap:14px;${css(n.design)}">${n.heading ? heading(n.heading, 'h3') : ''}${n.intro ? `<p class="muted" style="margin:0">${esc(n.intro)}</p>` : ''}<div style="display:flex;gap:14px">${f('Name')}${f('Email')}</div>${f('Message', 96)}<div>${btn('Send message')}</div></div>`
}

function node(n) {
  if (!n) return ''
  if (n.blockType === 'section') return section(n, true)
  if (n.blockType === 'element') return element(n)
  if (n.blockType === 'form') return formStub(n)
  return ph(n.blockType || 'block')
}

/* ------------------------------------------------------------------ document */
/** Builds a full HTML document for an item file (parsed JSON). `withFonts` adds the Google Fonts link. */
export function renderItem(item, { withFonts = true } = {}) {
  const st = STYLES.find((s) => s.id === item.meta?.style) || STYLES[0]
  CTX = { c: st.colors, primary: st.colors.primary, radius: st.radius ?? 12 }
  const body = (item.tree || []).map((s) => section(s)).join('')
  const bodyFont = fontStack(st.fonts?.body) || fontStack('inter')
  return `<!doctype html><html><head><meta charset="utf-8">${withFonts ? `<link rel="stylesheet" href="${fontsUrl}">` : ''}<style>
*{box-sizing:border-box}html,body{margin:0}body{width:1280px;font-family:${bodyFont};background:${st.colors.bg};color:${st.colors.text};line-height:1.55;font-size:16px}
.blk{position:relative;overflow:hidden}.blk>div:first-child,.col>*{position:relative;z-index:1}
.layer{position:absolute;inset:0;pointer-events:none;z-index:0}.div{position:absolute;left:0;width:100%;z-index:0;display:block}
.particles i{position:absolute;border-radius:50%;background:currentColor;opacity:.5}
.col{display:flex;flex-direction:column;min-width:0}.el{position:relative}
.h{margin:0;font-family:inherit;color:inherit;line-height:inherit;letter-spacing:inherit;text-transform:inherit}
.el .h{line-height:1.2}.el [style*="font-size:inherit"]{line-height:inherit}
.rt p{margin:0 0 .8em}.rt p:last-child{margin:0}.rt ul,.rt ol{padding-left:1.4em}
.btn{display:inline-block;border-radius:${st.radius ?? 12}px;font-weight:600;white-space:nowrap}
.muted{color:${st.colors.muted}}.ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}.ul li{display:flex;gap:10px;align-items:flex-start}
.big{font-size:44px;font-weight:800;line-height:1.1}.lbl{font-size:15px;line-height:1.4;font-weight:400;letter-spacing:0;text-transform:none;margin-top:6px}.logo{font-weight:800;font-size:22px;display:flex;gap:8px;align-items:center}
.ph{border:2px dashed #94a3b8;color:#64748b;padding:18px;text-align:center;font:600 13px monospace;border-radius:8px;background:rgba(148,163,184,.1)}
.imgph{background:linear-gradient(135deg,#e2e8f0,#cbd5e1);width:100%}.field{border:1px solid ${st.colors.border};background:rgba(255,255,255,.7);color:#94a3b8;border-radius:8px;padding:11px 14px;min-height:44px;font-size:15px}
.card{overflow:hidden}.tbl{border-collapse:collapse;width:100%}.tbl td,.tbl th{border-bottom:1px solid ${st.colors.border};padding:8px 10px;text-align:left}
.acc,.accitem{width:100%}.accitem{border-bottom:1px solid ${st.colors.border}}.acch{display:flex;justify-content:space-between;padding:16px 0;font-weight:600}
.tabbar{display:flex;gap:6px;border-bottom:1px solid ${st.colors.border};margin-bottom:20px}.tabbar span{padding:10px 18px;font-weight:600;opacity:.6;border-bottom:3px solid transparent}.tabbar span.on{opacity:1;border-color:${st.colors.primary}}
.arrow{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.9);color:#111;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:2}
</style></head><body>${body}</body></html>`
}
