# Template spec

How a template in this library must look. Every rule here is checked by `npm run build` (or
`npm run check`), so a template that breaks one fails the build.

The builder that reads this library is the Engage visual builder (the `gracengatsby` app). Its loader
reads `library.json` and `items/*.json` from this repository on GitHub. Those files are **generated**:
authors only write files under `templates/`.

```
templates/sections/<category>/<slug>.json   one section (authoring source)
templates/pages/<slug>.json                 one page (authoring source)
        │  npm run build
        ▼
items/<slug>.json      engage-template file the builder inserts
library.json           engage-library manifest the builder lists
catalog.json           search index: descriptions, industries, themes, styles, sections
previews/<slug>.png    picture shown in the builder (npm run previews)
```

## 1. Source file

```json
{
  "meta": {
    "slug": "hero-split-photo",
    "kind": "section",
    "title": "Split hero with photo",
    "category": "hero",
    "description": "Headline, text and two buttons on the left; a large photo on the right.",
    "tags": ["hero", "split", "photo"],
    "industry": ["saas", "agency"],
    "style": "shine-light",
    "frameworks": ["shine", "effix"],
    "version": "1.0.0"
  },
  "tree": [ { "blockType": "section", "design": { }, "columns": [ ] } ]
}
```

| Field | Rules |
| --- | --- |
| `slug` | `^[a-z0-9][a-z0-9-]{0,63}$`, unique. Name it `<category>-<what-makes-it-different>`, e.g. `pricing-three-tier-toggle`. |
| `kind` | `section` (one section) or `page` (a whole page: a list of sections). |
| `title` | Up to 120 characters, sentence case, describes the layout not the copy. |
| `category` | An id from `taxonomy/categories.json` (`sections` list for a section, `pages` list for a page). The file must live in `templates/sections/<category>/` or `templates/pages/`. |
| `description` | 10–300 characters. What the visitor sees and how it behaves on mobile. |
| `tags` | 1–10 lower-case tags, up to 40 characters each. Layout words (`split`, `grid`, `centered`, `dark`), content words (`photo`, `icons`, `form`), behaviour words (`carousel`, `accordion`, `animated`). |
| `industry` | One or more ids from `taxonomy/categories.json` → `industries`. Use `general` when it fits anything. |
| `style` | A style id from `taxonomy/styles.json`. Sets the theme (light / dark / mixed) and fills the `{{tokens}}` below. |
| `frameworks` | `["shine"]`, `["effix"]` or both. See section 6. |
| `version` | Optional semver; bump when you change a published template. |

## 2. The tree

The tree is exactly what the visual editor saves (see `reference/design.md`).

- A **section**: `{ "blockType": "section", "design": {…}, "columns": [ … ] }`.
- A **column**: `{ "label": "…", "width": 6, "layout": {…}, "design": {…}, "blocks": [ … ] }`. `width` is a 12-grid span (12, 9, 8, 6, 4, 3).
  For other widths use `widthDesktop` / `widthTablet` / `widthMobile` `{ "value": n, "unit": "fraction|percent|px|auto|fill" }`.
- An **element**: `{ "blockType": "element", "elementType": "heading", "props": {…}, "design": {…} }`.
  Element types and their props: `reference/elements.json` (exact fields, options and defaults) and
  `reference/elements-cheatsheet.md` (filled examples).
- A section can sit inside a column to make rows of buttons, cards and so on (nesting up to 24 levels).
- A section's `design.layout.display` turns its columns into `grid`, `carousel`, `tabs`, `accordion`,
  `modal`, `stack`, `hscroll` or `sticky-steps`. Panel titles come from `column.label`.
- A **page** tree is a list of sections. Prefer composing pages from library sections (section 4).

Rules:

1. Omit `_id` everywhere; the editor assigns ids.
2. Only `blockType` values from `reference/blocks.json`, `elementType` values from `reference/elements.json`.
   Prefer elements not marked `hidden` (hidden ones still render but are retired from the picker; the build warns).
3. `select` props must use one of the field's option values (checked). Note the British `centre` on `card.align`.
4. Only design keys from `reference/design-keys.json` (checked). Use the flat design form, never `schemaVersion: 2`.
5. Every top-level section sets `bgType` + its background, `textColor`, `paddingTop` / `paddingBottom`,
   a `mobile` padding override, and a boxed `layout` (`contentWidth: "boxed"`, `boxedWidth` 1100–1280).
6. Every multi-column row sets `layout.direction` with `"mobile": "column"` (or a grid with `gridColumnsMobile`).
   Templates must read well at 375 px wide.
7. Forbidden anywhere: `html`, `embed`, `embed-code`, `code` and any raw-HTML / script / iframe block;
   keys `__proto__`, `constructor`, `prototype`, `dangerouslySetInnerHTML`; text containing `<script`,
   `<iframe`, `javascript:` or `data:text/html`. The builder refuses the whole library otherwise.
8. Links: `button.url` is a plain string. Link fields on other elements (`card.link`, `icon-box.link`,
   `pricing-table.buttonUrl`, `call-to-action.buttonUrl`) take `{ "url": "/path" }`. Only `/path`, `#anchor`,
   `https://`, `mailto:` and `tel:` survive. Use realistic placeholder paths (`/contact`, `#pricing`).
9. Icons (`icon`, `icon-box`, `card`, `list`, `icon-list`) use the builder's built-in names only:
   `star heart check arrow mail phone pin bolt gift shield user clock leaf sparkle truck info home`.
10. Copy must be original, short and believable, written for a generic business in the template's industry.
    No lorem ipsum, no real brand names, no real people.

## 3. Authoring shorthands

The build expands these, so sources stay short and restylable:

| Write | Becomes |
| --- | --- |
| `"{{color.primary}}"` (also `onPrimary secondary accent bg surface surface2 text muted border dark`) | the colour from the item's style |
| `"{{font.heading}}"`, `"{{font.body}}"` | a built-in font key (`inter montserrat jost playfair cormorant cinzel`) |
| `"{{radius}}"` (whole value) | the style's corner radius as a number |
| `"img:office"` | `https://images.unsplash.com/photo-…?w=1600&q=80&auto=format&fit=crop` |
| `"img:office@800"` | same, 800 px wide (use ~2× the displayed width) |
| `"img:office@800\|Alt text"` in a media prop | `{ "url": "…", "alt": "Alt text" }` |
| `text-editor` `"content": "Para one\n\nPara **two**"` | the builder's Lexical rich-text JSON (`**bold**`, `*italic*`) |
| `{ "$section": "hero-split-photo" }` in a page tree | that section's tree, re-coloured with the page's style |

Photo ids come from `taxonomy/images.json` (verified, royalty-free, see `docs/IMAGES.md`). Images are
linked, not copied: `assets` stays empty and the builder shows the photo from its URL.

## 4. Pages

A page's `tree` is a list of sections, normally all `$section` references:

```json
"tree": [
  { "$section": "header-logo-links-cta" },
  { "$section": "hero-split-photo" },
  { "$section": "features-icon-grid" },
  { "$section": "cta-gradient-band" },
  { "$section": "footer-four-column" }
]
```

The page's own `style` is applied to every included section, so a page can re-theme sections that were
authored in another style. Inline sections are allowed for page-specific parts. The page's `meta.sections`
in `catalog.json` lists the sections it uses.

## 5. Look and feel (Shine)

Templates follow the [Shine](https://github.com/asticore/shine) design system so a site that also uses
Shine for hand-written pages matches:

- **Colour** only from style tokens. Primary for one main action per section; `surface` / `surface2` for
  alternating bands and cards; `muted` for secondary text; never more than one accent per section.
- **Spacing** on Shine's 4 px scale: 4 8 12 16 20 24 32 40 48 64 80 96 128. Sections 80–128 px top/bottom on
  desktop, 48–64 px on mobile. Gaps 16–48.
- **Type**: headings in `{{font.heading}}`; h1 48–64 px (mobile 34–40), h2 36–44 px (mobile 28–32),
  eyebrow labels 12–14 px uppercase with letter spacing 1–2. Body 16–19 px, line height 1.5–1.7.
- **Shape**: `{{radius}}` on cards, images and panels; `boxShadow` `sm`/`md` for cards, `lg` for hero media.
- **Theme**: light, dark or mixed (dark bands inside a light page) follows the style. Contrast must be readable.

## 6. Motion (Effix)

Builder effects are named after their [Effix](https://github.com/asticore/effix) equivalents, so templates
use the builder's native design keys (they work with no extra script) and the catalog records which Effix
vocabulary they follow:

| Effix class | Builder design key |
| --- | --- |
| `efx-reveal` + `data-efx-reveal="fade-up"` | `"reveal": "fade-up"` (+ `revealDelay`, `revealDuration`) |
| `efx-stagger` | increasing `revealDelay` on siblings (0, 2, 4…) |
| `efx-tilt` | `"pointerFx": "tilt"` |
| `efx-magnetic` | `"pointerFx": "magnetic"` |
| `efx-spotlight` | `"pointerFx": "spotlight"` |
| `efx-particles` | `"bgEffect": "particles"` (+ `particles*` keys) |
| `efx-divider` | `dividerTop` / `dividerBottom` (+ `dividerTopAnim: "drift"`) |
| `efx-parallax` | `"parallax": "background"` |
| `efx-counter` | `counter` element with `"animate": true` |
| `efx-carousel` | section `layout.display: "carousel"` |
| `efx-border-glow` / `efx-border-spin` | `"borderFx": "glow"` / `"conic-spin"` |
| `efx-popup` | section `layout.display: "modal"` with `popupDelay` / `popupScroll` |

Keep motion tasteful: one reveal style per section, delays ≤ 6, pointer effects on at most one or two
elements per section. List `effix` in `frameworks` when the template uses any of the keys above.

## 7. Checklist

- [ ] `npm run build` passes with no errors and no new warnings.
- [ ] `npm run previews` produced `previews/<slug>.png` and it looks right.
- [ ] Reads well at 375 px (mobile overrides set, rows stack).
- [ ] Copy is original; photos are `img:` ids; no forbidden content.
- [ ] Optional: `npm run verify:app -- --app ../gracengatsby` passes against a builder checkout.
