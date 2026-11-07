# Elements cheatsheet (authoring)

Element node: `{"blockType":"element","elementType":"<type>","props":{...},"design":{...}}`. Full field lists: `elements.json`.

## Conventions (verified in renderers: `src/components/blocks/elements/elementUtil.ts`)
- **Link field** (`type:'link'`: icon.link, icon-box.link, card.link, heading.link, image.link, pricing-table.buttonUrl, call-to-action.buttonUrl/secondUrl): value is `{url, newTab?, nofollow?}`; a plain URL string is also accepted (legacy). Safe schemes only: `/path`, `#anchor`, `https:`, `mailto:`, `tel:`; `//host` and `javascript:` are dropped.
- **`button` is different**: flat props `url` (STRING), `newTab` (bool), `nofollow` (bool), plus `variant` primary|secondary|plain, `size` sm|md|lg, `align`, `styleName`. Default `{text:"Learn more",url:"/",variant:"primary",align:"left",size:"md"}`.
- Plain `text` fields named url/href/link/address (list.href, icon-list.link, logo-strip.url, social-icons.address) are strings.
- **Icon** (`iconSet:'builtin'`, used by icon, icon-box, card, list, icon-list): plain string name, one of `star heart check arrow mail phone pin bolt gift shield user clock leaf sparkle truck info home`. (`{icon:"star"}` also accepted; FontAwesome `{icon:"fa-solid fa-..."}` is NOT used by these fields.) Unknown name -> falls back to star.
- **Media field** (`type:'media'`/`mediaOf`): accepts a plain URL string, or `{url, alt}` (also `{id,url,alt,srcSet}`); a bare numeric id cannot render. Elements with both `image` and `url` props (image, logo-strip rows) take either. `mediaMulti` (image-gallery.images) = array of the same; or use the `urls` textarea: one `"url | alt"` per line.
- Colours in element props: hex, rgb(a), hsl(a), or theme token `var(--eg-c-<id>)`.
- Select values are strings; `range`/`number` are numbers; checkbox booleans. `richText` (text-editor.content) = Lexical JSON `{root:{type:'root',children:[paragraph...]}}` (see elements.json defaults).
- `tabs`/`accordion` item content is plain textarea text. `team-member.social` is a textarea: lines of `network | url`. Repeaters = arrays of row objects.
- There is no `spacer`-only layout trick needed: `spacer` exists (`height` px). `divider` exists.

## Props + filled examples

### heading
text, tag h1-h6, align, link, effect none|two-tone|rotate|split|highlight (+ secondText/secondColour, words/speed, splitBy/animation, markerPhrase/markerStyle/markerColour)
`{"text":"Fresh bread, daily","tag":"h2","align":"center","effect":"none"}`

### text-editor
content (richText), align. Example: use the default Lexical shape from elements.json, change the text node.

### image
image (media), url, alt, caption, link, ratio 16:9|4:3|1:1|3:2|3:4|21:9|auto, fit cover|contain, width 0-100 (%), align, lightbox
`{"image":{"url":"/media/shop.jpg","alt":"Our shopfront"},"alt":"Our shopfront","caption":"Open since 2012","ratio":"16:9","fit":"cover","width":100,"align":"center"}`

### button
`{"text":"Book a table","url":"/book","variant":"primary","size":"lg","align":"center","newTab":false}`

### icon
icon, size 12-200, link, label, align
`{"icon":"heart","size":48,"link":{"url":"/about","newTab":false},"label":"Our story","align":"center"}`

### icon-box
icon, size, title, text, link, tag h2-h6|p, layout top|left, align
`{"icon":"truck","size":40,"title":"Free delivery","text":"On orders over 50.","link":{"url":"/shipping"},"tag":"h3","layout":"top","align":"center"}`

### card
media none|icon|image (+ icon / image, imageRatio auto|1:1|4:3|16:9, imageFit), title, titleTag, text, link, linkLabel, layout top|left|right, align left|centre (British spelling), bgColour, borderRadius, shadow none|sm|md|lg, hoverEffect none|lift|zoom-image|flip (+ backTitle/backText/backColour)
`{"media":"image","image":{"url":"/media/a.jpg","alt":"Loaf"},"imageRatio":"4:3","imageFit":"cover","title":"Sourdough","titleTag":"h3","text":"Slow-fermented for 24 hours.","link":{"url":"/menu/sourdough"},"linkLabel":"See more","layout":"top","align":"left","bgColour":"#ffffff","borderRadius":8,"shadow":"sm","hoverEffect":"lift"}`

### pricing-table
title, currency, price (string), period, features[{text,included}], buttonText, buttonUrl (link), ribbon, highlight
`{"title":"Pro","currency":"$","price":"49","period":"/ month","features":[{"text":"10 users","included":true},{"text":"SSO","included":false}],"buttonText":"Choose Pro","buttonUrl":{"url":"/signup?plan=pro"},"ribbon":"Popular","highlight":true}`

### testimonial
quote, name, role, photo (media), stars 0-5, align
`{"quote":"Best decision we made this year.","name":"Sam Ortiz","role":"Owner, Ortiz Cafe","photo":{"url":"/media/sam.jpg","alt":"Sam Ortiz"},"stars":5,"align":"center"}`

### team-member
photo, alt, name, role, bio, social ("network | url" lines), align
`{"photo":{"url":"/media/jo.jpg","alt":"Jo"},"name":"Jordan Lee","role":"Founder","bio":"Started the studio in a spare room.","social":"instagram | https://instagram.com/jo\nlinkedin | https://linkedin.com/in/jo","align":"center"}`

### counter
number, decimals, prefix, suffix, title, separator (thousands), animate, start, duration (ms), align
`{"number":1200,"decimals":0,"suffix":"+","title":"Happy customers","separator":true,"animate":true,"align":"center"}`

### count-up
start, end, prefix, suffix, duration (ms), decimals "0"|"1"|"2" (string), label
`{"start":0,"end":98,"suffix":"%","duration":1600,"decimals":"0","label":"Satisfaction"}`

### accordion
items[{heading,content}], openFirst
`{"items":[{"heading":"Delivery time?","content":"3 to 5 working days."},{"heading":"Returns?","content":"Within 30 days."}],"openFirst":true}`

### tabs
items[{title,content}]
`{"items":[{"title":"Overview","content":"Intro text."},{"title":"Details","content":"More text."}]}`

### nav-menu
layout horizontal|vertical, label, mobileBreakpoint never|768|1024, mobileStyle hamburger-dropdown|offcanvas, submenuStyle dropdown|mega, sticky, onePage. No item list: it renders the site's Header menu.
`{"layout":"horizontal","label":"Main menu","mobileBreakpoint":"768","mobileStyle":"offcanvas","submenuStyle":"dropdown","sticky":false,"onePage":false}`

### social-icons
items[{network facebook|instagram|x|youtube|linkedin|tiktok|pinterest|email|website, address}], shape circle|square|plain, size, align, mode follow|share, title
`{"items":[{"network":"instagram","address":"https://instagram.com/acme"},{"network":"email","address":"mailto:hi@acme.com"}],"shape":"circle","size":20,"align":"center","mode":"follow"}`

### logo-strip
items[{image,url,alt}], height 16-160, grayscale (default true). `url` is the image URL, not a link.
`{"items":[{"image":{"url":"/media/l1.svg","alt":"Acme"}},{"url":"/media/l2.svg","alt":"Globex"}],"height":40,"grayscale":true}`

### image-gallery
images (mediaMulti array), urls (textarea "url | alt" per line), columns 1-6, ratio
`{"images":[{"url":"/media/1.jpg","alt":"One"},{"url":"/media/2.jpg","alt":"Two"}],"columns":2,"ratio":"4:3"}`

### list
items[{text,href}], marker bullets|numbers|none|icon|check|arrow|dash, icon, iconColour, size, gap, align
`{"items":[{"text":"Fast"},{"text":"Reliable","href":"/why"}],"marker":"check","iconColour":"#2e3192","align":"left"}`

### icon-list
items[{text,link}], icon (one icon for all rows), layout stacked|inline, align
`{"items":[{"text":"Handmade","link":""},{"text":"Free returns","link":""}],"icon":"check","layout":"stacked","align":"left"}`

### call-to-action
title, text, buttonText, buttonUrl (link), secondText, secondUrl (link), tone dark|light|accent, align
`{"title":"Ready to start?","text":"Join today.","buttonText":"Get started","buttonUrl":{"url":"/signup"},"secondText":"Talk to us","secondUrl":{"url":"/contact"},"tone":"accent","align":"center"}`

### divider
showLine, gap, style solid|dashed|dotted|double, weight, width (%), label, align
`{"showLine":true,"gap":16,"style":"solid","weight":1,"width":100,"label":"or","align":"center"}`

### spacer
`{"height":48}`
