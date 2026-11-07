# Design object (BlockStyle) reference

Sources: `src/lib/blockStyle.ts` (BlockStyle), `src/lib/sectionLayout.ts` (SectionLayout, ColumnLayout), `src/lib/sectionTree.ts` (SectionColumn).
Every key is optional; unset = no CSS emitted. Unknown/invalid values are dropped on read (enums checked, numbers clamped, colours sanitised).
All keys below sit FLAT on `design` (a section / column / block node's `design` object). Stored designs may also be `schemaVersion: 2` with `groups` (grouped form, written by the editor); readers (`asBlockStyle`/`readFlatDesign`) accept both. For authoring, use the flat form (no schemaVersion).

Colours (`sanitizeColor`): hex, rgb()/hsl(), named colours, `transparent`, or a theme token `var(--token-name)`. No url()/expression.
Lengths: numbers are px unless a sibling `*Unit` key is set (units: px % em rem vw vh).

## Node tree (sectionTree.ts)
Section block: `{blockType:'section', design?:BlockStyle, columns: SectionColumn[]}`.
SectionColumn:
- `_id?` string (editor id), `label?` string (Navigator name; also the tab/accordion panel title when layout.display is tabs/accordion)
- `width?` legacy 12-grid span: 12|9|8|6|4|3 (default 12; used as desktop fallback)
- `widthDesktop?` / `widthTablet?` / `widthMobile?`: `{value:number, unit:'fraction'|'percent'|'px'|'auto'|'fill'}`. fraction = span 1..12 of 12; percent 0..100; px >=0; auto/fill ignore value (fill = take remaining row). Tablet inherits desktop, mobile inherits tablet when unset.
- `design?` BlockStyle (column background/padding etc.)
- `layout?` ColumnLayout: `grow, shrink` (number), `alignSelf` stretch|start|center|end, `order` {desktop?,tablet?,mobile?: number}, `minWidth` px, `vAlign` top|middle|bottom|between, `gap` px (between stacked blocks), `padding` {top,right,bottom,left} px
- `blocks?` SectionNode[]: `{blockType, _id?, design?, ...blockFields}`; `blockType:'section'` nests a section (with `columns`). Elements are `{blockType:'element', elementType, props:{...}, design?}`.

## Background
| key | values | meaning |
|---|---|---|
| bgType | none, color, gradient, image, video, slideshow | which background layer is used (set it, or the bg* keys are ignored) |
| bgColor | colour | solid colour (bgType color) |
| bgGradientFrom / bgGradientTo | colour | gradient stops (bgType gradient) |
| bgGradientAngle | number deg | gradient angle |
| bgImage | number or null | IMAGE: Media doc id |
| bgImageUrl | string or null | IMAGE: media URL (cached; this is what the renderer uses, so set it for templates) |
| bgVideoUrl | string | VIDEO: https or site-relative .mp4/.webm (validated by isSafeMediaUrl) |
| bgVideoPoster | string | VIDEO: poster image URL |
| bgVideoLoop | boolean | default true |
| bgSlides | string[] (max 6) | SLIDESHOW image URLs |
| bgSlideIds | number[] | Media ids matching bgSlides (editor picker) |
| slideInterval | 2-30 s (default 5) | seconds per slide |
| slideTransition | fade, slide, zoom | slideshow transition |
| noise | 0-100 | film-grain over background |
| bgOverlay | 0-100 | legacy darkening of image bg for text legibility |
| overlayType | none, color, gradient | general overlay layer (any block) |
| overlayColor / overlayColor2 | colour | overlay colour / gradient end |
| overlayAngle | 0-360 (180) | overlay gradient angle |
| overlayOpacity | 0-100 (50) | overlay opacity |
| overlayBlend | normal, multiply, screen, overlay, soft-light, color, luminosity | overlay blend mode |
| kenBurns | none, zoom-in, zoom-out, pan | slow zoom/pan of the bgImageUrl image |
| kenBurnsDuration | 4-60 s (14) | loop length |
| maskShape | none, circle, rounded, blob, hexagon, diamond, arch, triangle, wave, blob-morph | clip-path over whole block |
| blobMorphSpeed | slow, medium, fast | for maskShape blob-morph |

## Spacing (px unless unit key)
paddingTop, paddingBottom, paddingLeft, paddingRight, marginTop, marginBottom, marginLeft, marginRight; `paddingUnit`, `marginUnit` (LengthUnit); legacy `paddingTopMobile`, `paddingBottomMobile` (read as mobile override). `minHeight` + `minHeightUnit` (unset=px; `minHeight:100, minHeightUnit:'vh'` = fit screen).

## Typography / colour
fontFamily (built-in font key, `var(--font-xxx)` / `var(--eg-font-xxx)` token, or `family:<installed>`), textColor (colour), textAlign (left|center|right), fontSize (1-400) + fontSizeUnit (px|em|rem|vw), fontWeight (100-900 step 100), lineHeight (0.5-5 unitless), letterSpacing (-20..50) + letterSpacingUnit (px|em), wordSpacing (px -20..100), textTransform (none|uppercase|lowercase|capitalize), fontStyle (normal|italic), textDecoration (none|underline|line-through), textShadow (none|sm|md|lg).
Text effect: textFx (none|gradient|outline|shadow-glow), textFxColor, textFxColor2 (gradient end), textFxAngle (0-360, 90), textFxStroke (1-6 px), textFxAnimated (bool).
Typography is emitted on the wrapper; headings/paragraphs inside inherit.

## Border / radius / shadow
borderWidth (px), borderStyle (solid|dashed|dotted), borderColor, borderRadius (px), radiusTl/radiusTr/radiusBr/radiusBl (0-999; unset corners fall back to borderRadius), radiusLinked (editor only), boxShadow (none|sm|md|lg). borderFx (none|glow|conic-spin) with borderFxColor, borderFxWidth, borderFxSpeed.
Glass: glass (bool), glassBlur (0-40, 12), glassOpacity, glassBorder.

## Width / alignment / position
width: contained|wide|full (block width). Inside a column: selfAlign (stretch|start|center|end), selfWidth (auto|full|custom), selfWidthPercent + selfWidthPercentUnit.
position (relative|absolute|fixed|sticky), posTop/posRight/posBottom/posLeft, zIndex, opacity (0-100), blendMode (CSS blend names), filterBlur, filterBrightness, filterContrast, filterSaturate, filterGrayscale, filterHue.

## Section layout: `design.layout` (SectionLayout, sections only)
Flow: `direction` {desktop?,tablet?,mobile?: row|row-reverse|column|column-reverse} (tablet falls back to desktop, mobile to tablet); `wrap` bool (false = single line); `gap` {desktop?,tablet?,mobile?: number px}; `gapUnit` px|rem; `justify` start|center|end|between|around|evenly; `alignItems` start|center|end|stretch; `contentWidth` boxed|full; `boxedWidth` px; `verticalAlign` top|middle|bottom; `tablet`/`mobile` {wrap, justify, alignItems}.
`display` = columns (default) | tabs | accordion | carousel | grid | flex | modal | stack | hscroll | sticky-steps. Extra keys per mode:
- tabs: `tabsAlign` start|center|end|stretch, `tabsColor` colour. Each column = a panel titled by `column.label` (fallback "Tab N").
- accordion: `tabsColor`; panels titled by `column.label` (fallback "Panel N").
- carousel: `carouselPerView` 1-4 (1), `carouselGap` 0-64 px (16), `carouselArrows` bool (true).
- grid: `gridColumns` 1-6 (3), `gridColumnsTablet` (=desktop), `gridColumnsMobile` (1), `gridGap` 0-64 (16), `gridGapTablet`, `gridGapMobile`, `gridAlign` start|center|end|stretch, `gridJustify` same, `gridMinWidth` 80-800 px (auto-fit; replaces column counts), `gridFlow` 'dense'.
- modal: `modalLabel` (1-60 chars, "Open"), `modalWidth` 320-1200 (640), `modalStyle` button|link. Popup triggers (modal): `popupDelay` 0-600 s, `popupScroll` 1-100 %, `popupExit` bool, `popupFrequency` always|session|days, `popupDays` 1-365.
- stack: `stackTop` 0-200 (24), `stackOffset` 0-60 (16), `stackMinHeight` 30-100 vh (70).
- hscroll: `hscrollLength` 200-600 vh (300), `hscrollColumnWidth` 40-100 vw (80).
- sticky-steps: `stickyStepsSide` left|right, `stickyStepsTop` 0-200 (96), `stickyStepsGap` 0-160 (48).

## Responsive / device overrides
`design.tablet` / `design.mobile` = DeviceOverride: only these keys are kept: paddingTop/Bottom/Left/Right, marginTop/Bottom/Left/Right, paddingUnit, marginUnit, selfWidthPercentUnit, textAlign, minHeight, minHeightUnit, selfAlign, selfWidth, selfWidthPercent, fontSize, fontSizeUnit, lineHeight, letterSpacing, radiusTl/Tr/Br/Bl, plus `hide` (bool, that device only). Mobile inherits tablet. Desktop = base keys.
Visibility: hideOnMobile, hideOnDesktop (bool). Display conditions (all set must pass, browser-side): showFrom, showUntil (date strings), showAuth ('in'|'out'), showRoles (comma list of role slugs), showUrl (text the path/query contains).

## Effects
- Background effect: bgEffect (none|aurora|mesh|gradient-shift|grain|dots|grid|particles), bgEffectColor, bgEffectColor2, bgEffectIntensity 0-100 (50). Per effect: particlesCount 10-120, particlesInteract (none|repel|attract|connect), particlesSizeMin/Max, particlesSpeed, particlesOpacity, particlesLinks, particlesLinkDistance, particlesInteractRadius, particlesShape (circle|square); dotSize, dotSpacing; gridSize, gridLineWidth; auroraBlur, auroraSize, auroraSpeed; gradientAngle, gradientSpeed; grainOpacity, grainSize.
- Parallax: parallax (none|background|float-up|float-down), parallaxStrength 0-100 (40), parallaxDistance 0-400, parallaxDirection up|down.
- Reveal on scroll: reveal (none|fade|fade-up|fade-down|slide-left|slide-right|zoom|blur), revealDistance, revealDuration, revealDelay, revealEasing (linear|ease|ease-in|ease-out|ease-in-out).
- Hover preset: hover (none|lift|glow|zoom), hoverLift, hoverScale. Pointer: pointerFx (none|spotlight|tilt|magnetic), pointerFxStrength, spotlightColor.
- Hover state styling: hoverBgColor, hoverTextColor, hoverBorderColor, hoverBoxShadow (box shadow presets), hoverBorderRadius 0-200, hoverTransitionMs 0-2000 (250), hoverOpacity 0-1, hoverTransform (none|lift|scale), focusRing (colour).
- Transform: tfRotate (deg), tfScale, tfTranslateX, tfTranslateY (px), tfSkewX, tfSkewY; hover versions tfhRotate/tfhScale/tfhTranslateX/tfhTranslateY/tfhSkewX/tfhSkewY; tfDuration 0-2000 ms.
- Shape dividers: dividerTop / dividerBottom (none|wave|tilt|curve|triangle|arrow|waves|zigzag|clouds|drips|mountains|curve-asym|slant-double|pill|steps|spikes), dividerTopColor / dividerBottomColor, dividerTopHeight / dividerBottomHeight (px), dividerTopFlip / dividerBottomFlip (bool), dividerTopAnim / dividerBottomAnim (none|drift|layers|float), dividerTopSpeed / dividerBottomSpeed (s).
- Advanced: customClass, cssClasses (space-separated classes), anchorId (in-page anchor), customCss (scoped CSS; write `selector` for this block; sanitised).

## Image-holding design keys
`bgImage` (media id) + `bgImageUrl` (URL; renderer uses this), `bgVideoPoster` (URL), `bgSlides` (URL[]) + `bgSlideIds` (id[]). kenBurns/maskShape/overlay act on bgImageUrl. For a URL-only template set `bgType:'image'` + `bgImageUrl`.

## Example
```json
{"bgType":"image","bgImageUrl":"/media/hero.jpg","overlayType":"color","overlayColor":"#000000","overlayOpacity":45,
 "paddingTop":96,"paddingBottom":96,"textColor":"#ffffff","textAlign":"center",
 "layout":{"display":"columns","direction":{"desktop":"row","mobile":"column"},"gap":{"desktop":24},"contentWidth":"boxed","boxedWidth":1100},
 "tablet":{"paddingTop":64},"mobile":{"paddingTop":40,"fontSize":28}}
```
