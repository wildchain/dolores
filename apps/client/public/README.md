# Dolores landing page (v23)

Static, three-page marketing site. No build step, no framework, no package manager.
Open `index.html` in a browser and it runs.

## Files

```
index.html      Home
builders.html   /builders
staking.html    /staking
styles.css      All styles for all three pages
app.js          Scroll progress, scroll reveal, nav dropdown,
                the accountability loop, the waitlist form
favicon.png     Favicon, also used as the footer brand mark
img/
  hero_head.jpg          Home hero key visual
  logo_full_nodot.png    Logo lockup used in the nav
```

Every page links to `styles.css` and `app.js`. Cross-page navigation uses plain
filenames, so the three files must stay in the same directory as each other.

## Two things to wire up before this goes live

**1. The waitlist has no provider.** Every call to action that used to open the
app now scrolls to `#waitlist`. Set one constant at the top of the waitlist
block in `app.js`:

```js
var WAITLIST_ENDPOINT = '';   // e.g. 'https://api.provider.com/v1/subscribe'
```

It POSTs `{"email": "..."}` as JSON and treats any non-2xx as a failure. While
the constant is empty the form opens a prefilled mail to hello@dolores.id, so it
works today and never reports a signup that was not recorded. Do not replace
that fallback with a fake success state.

**2. Confirm the outbound URLs.** The site deliberately does not link to the
product anywhere, because it is not live yet.

| Where | Current target |
|---|---|
| Nav "Get notified", hero "Get early access", persona card, footer | `#waitlist` on the same page |
| Builders and staking CTAs | `#waitlist`, `https://docs.dolores.id/builders`, `https://docs.dolores.id/staking` |
| Home hero secondary | `https://docs.dolores.id/litepaper` |
| Resources dropdown | `https://docs.dolores.id`, `https://docs.dolores.id/litepaper`, `https://github.com/doloresid` |
| Footer legal | `/terms` and `/privacy`, both placeholders, no pages exist yet |
| Footer social | `https://x.com/DoloresID_HQ`, `mailto:hello@dolores.id` |

The GitHub organisation name in the Resources dropdown is unconfirmed; check it
against the real repository before shipping.

## Fonts

Loaded over the network by two `@import` rules at the top of `styles.css`:

- Google Fonts: Work Sans (body), JetBrains Mono (data and code), Sora (stat figures)
- Fontshare: Cabinet Grotesk (display and headlines)

If you self-host, replace those two imports and keep the family names identical,
since the CSS custom properties reference them by name. Keep the file free of a
byte order mark: a BOM ahead of the first `@import` can make some parsers drop it.

## The accountability loop

The four-stage ring on the home page is plain SVG plus about eighty lines in
`app.js`. It advances every 3.6 seconds, pauses on hover, and holds still while
a stage has keyboard focus so it cannot move out from under someone reading it.
Each node is a real `<button>`, so it works by keyboard, and under
`prefers-reduced-motion` it stops auto-advancing but stays clickable.

The worked example is data, not markup. To change it, edit the `STAGES` array at
the top of that block and the sub-line in the section head. Nothing else refers
to it. The comet's orbit duration in the stylesheet is four times the stage
interval, so if you change one, change the other.

Below 760px the ring is replaced by a 2x2 chip grid with the stage detail
underneath; both layouts are driven by the same markup and the same state.

## Layout behaviour worth knowing

- **Responsive down to 390px.** Breakpoints at 1100, 900, 820, 760, and 640px.
- **Wide screens are capped.** `--edge-gutter` measures how much wider the
  viewport is than the 1440px band the layout was composed at. The hero key
  visual and the corner ornaments hug that band rather than the screen edge, so
  they stop drifting away from the copy on a large monitor or when the browser
  is zoomed out. Below 1441px nothing is affected.
- The hero's colour field still runs to the screen edge. Its ramp is sampled
  from `hero_head.jpg` so the artwork dissolves into it without a seam. If you
  swap the hero image, resample that gradient or the join will show.
- **Current page in the nav** is driven by `aria-current="page"` in the markup,
  not by JavaScript. If you move to a template or a router, keep setting that
  attribute or the active underline disappears.
- Scroll-reveal is applied by `app.js` via the `.reveal` and `.stagger` classes
  and an IntersectionObserver. Elements start at `opacity:0`, so if you strip
  the JS you must also remove those classes or the content stays invisible.
- The page is light-theme only by design. There is no dark mode variant.

## Structure notes

`styles.css` is a base layer followed by several appended override layers, in
this order: base, v21 brand reskin, review fixes, v22 additions, then v23 rounds
1 to 7. Later blocks are intended to win, so if you refactor, preserve the
cascade order or the brand palette and a number of layout fixes will regress.

Ordering rules that are load-bearing:

- Mobile media queries have to stay after the base rules they correct. A base
  rule placed after a breakpoint silently overrides it; this has caused the
  mobile hero and the problem band to stop collapsing twice already.
- The footer brand link needs its `display:flex` rule to outrank
  `footer.site .foot-col a{display:block}`, which is why that selector is
  written long-hand near the end of the file.
- Rules for the loop's ring layout are scoped `@media (min-width:761px)` rather
  than written at base level, so the narrow-screen layout does not have to undo
  them.

There is dead CSS in the file: the `usp-strip` and `ladder` blocks belong to
sections v23 replaced. They are inert and were left rather than risk the
cascade. Safe to delete if you are refactoring properly.

## Known gaps

- No mobile nav menu. Below 900px the top nav links are hidden and the footer
  carries navigation. This is a deliberate deferral, not an oversight.
- `/terms` and `/privacy` need real pages.
- The Dolores ID card mid-page is illustrative sample data (agent 7F3A-91C2,
  trust score 842), as are the figures inside the accountability loop. Replace
  them with real or clearly labelled example data before launch.
- The wordmark has no dot inside the D. That is deliberate as of v23, not a
  clipped asset.
