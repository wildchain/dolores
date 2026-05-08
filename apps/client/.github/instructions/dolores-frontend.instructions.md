---
applyTo: "apps/client/**"
---

# Dolores Frontend — Design System Instructions

All UI work in `apps/client/` must follow the Dolores brand system defined in `apps/client/src/styles/tokens.css`. These rules apply to every page, component, and style you write.

## Fonts

- **Inter** — all prose, headings, display text. Weights: 400, 500, 600, 700.
- **JetBrains Mono** — numbers, tags, metadata, monospace labels only. Never use for prose sentences.

Both are loaded via Google Fonts in `globals.css`.

## Color tokens — always use the CSS variable, never hard-code hex

| Token              | Hex       | Use                                                                                     |
| ------------------ | --------- | --------------------------------------------------------------------------------------- |
| `--accent`         | `#5BAFD6` | Kickers, stats, links, focus rings, interactive affordances. The hardest-working color. |
| `--primary`        | `#D7EFFF` | Text/elements on dark (navy) panels                                                     |
| `--primary-subtle` | `#EBF7FF` | Pullquote bg, chip bg, flywheel cells                                                   |
| `--primary-hover`  | `#B8E3FF` | Hover state for chips                                                                   |
| `--navy`           | `#0D1B2A` | Dark panel backgrounds only — never as text color                                       |
| `--bg`             | `#FFFFFF` | Page and card background                                                                |
| `--surface-raised` | `#F8F9FA` | Table headers, tiles, side-note panels                                                  |
| `--surface-sunken` | `#F1F3F5` | Recessed areas — use sparingly                                                          |
| `--border-subtle`  | `#E8EAED` | Default card and divider border                                                         |
| `--border-strong`  | `#DADCE0` | Table header underlines                                                                 |
| `--fg`             | `#0A0A0B` | Body text, headlines                                                                    |
| `--fg-muted`       | `#5F6368` | Secondary text, descriptions                                                            |
| `--fg-subtle`      | `#9AA0A6` | Decorative labels only — **never body copy** (fails WCAG AA)                            |
| `--fg-inverse`     | `#FFFFFF` | Text on `--accent` or `--navy`                                                          |
| `--ok`             | `#16A34A` | Success state                                                                           |
| `--warn`           | `#D97706` | Warning state                                                                           |
| `--danger`         | `#DC2626` | Error / destructive                                                                     |

## Type scale — use `--fs-*` tokens, not raw px

| Token     | Range   | Usage                               |
| --------- | ------- | ----------------------------------- |
| `--fs-12` | 11–12px | Metadata, kickers, uppercase labels |
| `--fs-14` | 13–14px | Small body, captions                |
| `--fs-16` | 15–16px | Card body, checklist items          |
| `--fs-18` | 16–18px | **Default body**                    |
| `--fs-20` | 17–20px | Step titles, phase headings         |
| `--fs-24` | 20–24px | Sub-headlines                       |
| `--fs-32` | 26–34px | Section H2                          |
| `--fs-44` | 32–48px | Large stat figures                  |
| `--fs-60` | 40–64px | Claim/hero headlines                |
| `--fs-88` | 52–96px | Cover wordmark                      |

## Radius & shadow

| Token         | Value   | Use                                              |
| ------------- | ------- | ------------------------------------------------ |
| `--radius-sm` | 6px     | Badges, small chips                              |
| `--radius`    | 10px    | Cards, flywheel cells                            |
| `--radius-lg` | 16px    | Large cards, panels, modals                      |
| Pill          | `999px` | Round tags/chips — apply inline, no token needed |
| `--shadow-sm` | —       | Default card rest state                          |
| `--shadow-md` | —       | Card hover, raised panels                        |
| `--shadow-lg` | —       | Modals, floating elements. Max 2 on a page.      |

## Spacing scale

Use only these values: **8, 10, 14, 16, 20, 24, 28, 32, 40, 48** px (or the `--space-*` tokens). Never hand-tune spacing to arbitrary pixel values.

## Ambient backgrounds

Every page/section container should have a subtle radial gradient on the `::before` pseudo-element:

- Light: `var(--ambient-light)` (pre-defined in tokens.css)
- Dark: `var(--ambient-dark)` (pre-defined in tokens.css)

Never use these as flat fills — only on `::before`.

## Component patterns

### Section opener

```tsx
<p className="kicker">Section label</p>
<h1 className="text-[--fg] font-bold tracking-[-0.025em]">Claim headline</h1>
<h2 className="text-[--fg-muted] font-normal">Sub-headline expanding the claim.</h2>
```

### Card

```tsx
<div className="bg-[--bg] border border-[--border-subtle] rounded-[--radius-lg] shadow-[--shadow-sm] p-6">
```

### Accent-left card (emphasis)

```tsx
<div className="... border-l-[3px] border-l-[--accent]">
```

### Chip / tag

```tsx
<span className="text-[--accent] bg-[--primary-subtle] border border-[--primary] rounded-full px-[10px] py-[4px] text-[--fs-12] font-semibold uppercase tracking-[.06em]">
```

### Dark panel (navy)

```tsx
<div className="bg-[--navy] text-[--primary] rounded-[--radius-lg] p-10 relative overflow-hidden">
  <div
    className="absolute inset-0 pointer-events-none"
    style={{ background: "var(--ambient-dark)" }}
  />
  {/* content with z-10 */}
</div>
```

### Kicker (eyebrow label)

```tsx
<p className="text-[--accent] font-semibold uppercase tracking-[.14em] text-[--fs-12]">
```

## Rules

**Do:**

- Always reference `var(--token)` — never hard-code hex values in CSS or inline styles
- Use `--accent` for stats, kickers, links, and interactive affordances
- Use JetBrains Mono for numbers, tags, and metadata labels
- Apply ambient gradient on `::before` on every major section
- Pair every semantic color (`--ok`, `--warn`, `--danger`) with an icon or text label — never color alone

**Don't:**

- Use `--fg-subtle` for body text — decorative only, fails WCAG AA
- Use `--accent` as a text color for full sentences — fine for short labels only
- Place more than two `--shadow-md` cards on the same view
- Use `--navy` panels next to `--surface-sunken` — contrast too harsh
- Invent spacing values outside the 8pt scale
- Use Fraunces, Epilogue, or other legacy fonts from the old theme
