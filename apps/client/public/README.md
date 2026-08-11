# Dolores landing page (v24)

Static marketing site. No build step, no framework, no package manager.
Open `index.html` in a browser and it runs.

## Files

```
index.html      Home
builders.html   /builders
verifiers.html  /verifiers   (replaces the old /staking page)
staking.html    Redirect stub -> verifiers.html, keeps old links alive
styles.css      All styles for all pages (unchanged from v23)
app.js          Scroll progress, scroll reveal, nav dropdown,
                the accountability loop, the waitlist form (unchanged from v23)
favicon.png     Favicon, also used as the footer brand mark
img/
  hero_head.jpg          Home hero key visual
  logo_full_nodot.png    Logo lockup used in the nav
```

Every page links to `styles.css` and `app.js`. Cross-page navigation uses plain
filenames, so all files must stay in the same directory.

## What changed in v24

**1. /staking became /verifiers, and the product changed with it.**
The old page sold delegation to *agents*, paid from a 400M $DOL emissions pool,
with delegators absorbing slashing losses. That is an investment product: capital
in, yield out, from the efforts of others. It is now a recruitment page for people
who want to *run* a verifier - check agent actions against the mandates they
signed, post a bond in $DOL to qualify, get paid in USDC for the work. Delegation
survives as one line, framed from the operator's side.

`staking.html` is a redirect stub with a canonical tag and `noindex`, so existing
links and shares do not 404. Delete it once nothing points there.

**2. Bond language throughout, not staking.**
Three bonds, two currencies:

| Who | Bond | Currency | Guarantees |
|-----|------|----------|------------|
| Agent | Performance bond | USDC | it will do the job it accepted |
| Verifier | Verification bond | $DOL | it will judge honestly |
| Challenger | Challenge bond | $DOL | it will not file nonsense |

Never write *staking rewards*, *stake to earn*, or *APY* on this site.

**3. Two factual corrections on builders.html.**
- Step 04 said "the challenger and treasury receive the split", which told readers
  Dolores takes a cut of slashing. It does not. The challenger is paid in full.
- Step 01 said "higher stakes unlock higher trust tiers", which let a bigger wallet
  buy reputation and contradicted the claim that trust comes from action history.
  Bond and trust are now separate.

**4. One overclaim softened on index.html.**
"If it fails, you get paid. Automatically, on Solana." became "its bond pays you
back". Recourse needs a bonded challenge inside a 7-day window. It is not automatic.

**5. Homepage personas are now hire / verify / build.**
Persona two was "Back the agents you believe in" and is now "Get paid to check the
work", linking to /verifiers.

## Two things to wire up before this goes live

**1. The waitlist has no provider.** Unchanged from v23 - every CTA scrolls to
`#waitlist` and the form falls back to `mailto:`. Set the constant at the top of
the waitlist block in `app.js`.

**2. Nothing links to a hirer page.** "Hire on evidence" is the lead persona and is
tagged "Start here", but its CTA goes to the waitlist. Verifiers and builders both
have a page; the most commercially important persona does not.

## Known gap

The adjudication story is not on the site. "Who decides it failed? Nobody - the
mandate is signed up front, so failure is a query, not an opinion" is the first
question a serious visitor asks, and the homepage loop jumps from 03 Fail to
04 Recourse with nothing in between.
