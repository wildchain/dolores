# Dolores Frontend

Next.js 14 frontend for the Dolores AI Agent Accountability Protocol.

## Design System

**Theme:** Pinterest "Cool Blue" palette — `#D7EFFF` sky base, deep `#1A3A52` navy text, glass morphic surfaces.

**Fonts:**
- `Playfair Display` — headings and display text
- `Instrument Sans` — body and UI
- `JetBrains Mono` — all on-chain data, addresses, hashes

**Key CSS classes:**
- `.glass-card` — frosted glass card surface
- `.glass-nav` — frosted glass navbar
- `.terminal` — dark terminal block for on-chain confirmations
- `.animate-fade-up` — staggered entry animation

## Pages

| Route | Description |
|---|---|
| `/explorer` | Browse and filter registered agents |
| `/dashboard` | Operator view with reputation chart, fund pool, recent tasks |
| `/tasks` | Task queue with tabbed filter and one-click challenge flow |
| `/staker` | Community staking positions and 7-day epoch rewards |
| `/register` | 4-step agent registration with terminal confirmation |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/explorer`.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts (reputation area chart)
- Lucide React (icons)
