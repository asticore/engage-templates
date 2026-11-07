# Engage Templates

A template library for the **Engage visual builder** (the `gracengatsby` app). It holds ready-made
**sections** (a hero, a pricing table, a footer…) and whole **pages** that a site owner picks from the
builder's templates panel and drops onto a page.

Templates follow the [Shine](https://github.com/asticore/shine) design system for colour, type, spacing
and shape, and use the builder's motion effects named after [Effix](https://github.com/asticore/effix)
(reveal, tilt, magnetic, particles, dividers, counters, carousels). They need no extra CSS or script.

This repository is only a library: JSON files and preview pictures. Nothing in it runs on a site.

## Use it in the builder

1. In the builder's admin, open **Settings > Template libraries**.
2. Add `https://github.com/asticore/engage-templates` (or `…/tree/<tag>` to pin a version).
   The repository must be public.
3. Open the visual editor's templates panel, or **Templates > Library**. Filter by category, search by
   title or tag, and insert a section or create a page.

Photos are linked from Unsplash (royalty-free, see [docs/IMAGES.md](docs/IMAGES.md)); replace them with
your own from the Media gallery after inserting.

## What's inside

| | Count | Categories |
| --- | --- | --- |
| Sections | 50 | Announcement, Header, Hero, Logos, Features, Content, Stats, Process, Testimonials, Pricing, Team, FAQ, Call to action, Newsletter, Contact, Gallery, Blog, Commerce, Footer |
| Pages | 13 | Landing, Business, About, Services, Contact, Pricing, Portfolio, Hospitality, Events, Health & wellness, Shop |

Every item carries search metadata in `catalog.json`: category, tags, description, industries
(SaaS, agency, restaurant…), theme (light / dark / mixed) and one of 8 style presets
(`taxonomy/styles.json`: Shine Light, Shine Dark, Ocean, Sunset, Forest, Mono, Luxe, Candy).

## Layout

```
templates/sections/<category>/<slug>.json  authoring sources (edit these)
templates/pages/<slug>.json                pages, composed from sections with {"$section": "<slug>"}
items/<slug>.json                          generated engage-template files the builder inserts
library.json                               generated engage-library manifest the builder reads
catalog.json                               generated search index with full metadata
previews/<slug>.png                        generated preview pictures
taxonomy/                                  categories, industries, style presets, verified photos
reference/                                 element, block and design reference extracted from the builder
schema/                                    JSON Schemas for every file format
docs/TEMPLATE_SPEC.md                      how a template must look (the authoring rules)
scripts/                                   build, previews, validation
```

## Add or change a template

Read [docs/TEMPLATE_SPEC.md](docs/TEMPLATE_SPEC.md) first. Then:

```bash
npm run build
```

```bash
npm run previews -- <slug>
```

```bash
npm run check
```

- `build` validates every source (the builder's own rules, plus element names, option values and design
  keys from `reference/`) and regenerates `items/`, `library.json` and `catalog.json`.
- `previews` renders an approximate picture of each item with the pre-installed Playwright Chromium.
- `check` is what CI runs: it fails if anything is invalid or the generated files are out of date.
- `npm run verify:app -- --app ../gracengatsby` runs the builder app's real validators over every item,
  given a local checkout of the app.

Authoring shorthands keep sources short and re-themable: `{{color.primary}}`, `{{font.heading}}`,
`{{radius}}`, `img:<photo-id>@<width>|<alt>`, plain-text rich text, and `$section` references in pages.

## License

Templates and tooling: MIT. Photos: their own licenses (see `taxonomy/images.json`).
