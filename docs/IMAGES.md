# Images

Templates show photos by **linking** to them, not by copying them into this repository. The builder accepts
an `https://` URL in any picture field (`{ "url": "…", "alt": "…" }`) and in `design.bgImageUrl`, and shows it
as is. Nothing is downloaded when a template is inserted, and `assets` in item files stays empty.

## Where the photos come from

`taxonomy/images.json` lists every photo a template may use. Each entry has an `id`, the base `url`, the
`source`, the `license` and a few `tags` for finding one. Every URL in the list was checked to respond with
HTTP 200 when it was added.

All current photos are from [Unsplash](https://unsplash.com) under the
[Unsplash License](https://unsplash.com/license): free to use for commercial and non-commercial work,
no permission or attribution needed. You may not sell them unaltered or use them to build a competing
photo service.

[Pixabay](https://pixabay.com/service/license-summary/) and [Pexels](https://www.pexels.com/license/) photos
are also royalty-free and can be added the same way. Pixabay asks that its CDN links are not hot-linked
long-term (they expire), so for Pixabay download the picture, add it under `images/` and reference it through
the builder's `assets` mechanism instead (see the builder's `docs/template-libraries.md`, section 5).

## Using a photo in a template

Write `img:<id>` in place of a URL. The build turns it into a sized, compressed link:

```json
{ "elementType": "image", "props": { "image": "img:office@1200|Bright open-plan office" } }
{ "design": { "bgType": "image", "bgImageUrl": "img:mountains@2000" } }
```

- `@<width>` picks the width (default 1600). Use about twice the width the photo is shown at.
- `|<alt text>` gives the alt text; in a picture prop the value becomes `{ "url": …, "alt": … }`.
- The build lists every photo an item uses in `meta.images` of the item file, with its source and license.

## Adding a photo

1. Find a photo on Unsplash (or Pexels) that is free under its license.
2. Copy its image URL without query parameters, e.g. `https://images.unsplash.com/photo-1497366216548-37526070297c`.
3. Check it responds: `curl -sI "<url>?w=64" | head -1` should print `HTTP/2 200`.
4. Add an entry to `taxonomy/images.json` with a short unique `id`, `source`, `license` and `tags`.

## Replacing photos on a site

Linked photos stay on the image host. After inserting a template, a site owner can swap any photo for one
from their own Media gallery in the builder's picture field; that is the normal next step for real content.
