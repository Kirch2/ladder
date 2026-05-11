# Ladder

Live L2 order book widget for Hyperliquid. Streams `l2Book` over WebSocket and renders 14 levels per side for BTC and ETH with adjustable price precision.

**Live:** [orderbook-topaz.vercel.app](https://orderbook-topaz.vercel.app) · **Repo:** [Kirch2/ladder](https://github.com/Kirch2/ladder)

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Radix Select (via shadcn) · lucide-react
- vitest + @testing-library

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (webpack — see note below) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm test` | vitest run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Data source

Subscribes to `wss://api.hyperliquid.xyz/ws` with `{ type: "l2Book", coin, nSigFigs }`. The dropdown surfaces a coin-specific list of tick prices that map to one of nSigFigs ∈ {2,3,4,5} at the current reference price.

## Project layout

```
app/
├── components/
│   ├── order-book.tsx        # top-level orchestration + SpreadRow
│   ├── book-row.tsx          # one price level (memo'd + hover-freeze)
│   ├── control-bar.tsx       # header: precision + status + symbol
│   ├── precision-select.tsx  # Tick dropdown
│   ├── coin-select.tsx       # Symbol dropdown
│   ├── coin-icon.tsx         # inline SVG mark per coin
│   ├── status-dot.tsx        # live / connecting / stale / error
│   ├── skeleton-row.tsx
│   ├── types.ts              # Tick type
│   └── ui/select.tsx         # shadcn Select wrapper
├── hooks/
│   └── use-order-book.ts     # WebSocket lifecycle + subscriptions
└── lib/
    ├── hyperliquid.ts        # API constants + types
    ├── format.ts             # formatters + sigFigs ↔ tick helpers
    └── utils.ts              # cn() helper
```

## Notable behavior

- **Hover-freeze**: hovering a row pins its size / total / cumulative bar to that moment. Other rows keep updating.
- **Inside-price ▲/▼ tick**: 1.5s fade next to the best bid / ask on price change.
- **Depth imbalance bar**: thin colored bar on the spread row, split by total visible bid vs ask volume. The dominant side brightens; the smaller side dims.
- **Status dot**: green live, amber connecting / stale (no message in 5s), red error.
- **Reconnect**: exponential backoff (1.5s → 30s cap). Forced reconnect if the tab was hidden longer than 5s.

## Customization

To add a coin: extend `Coin`, `COINS`, `TICK_OPTIONS_BY_COIN`, and `SIZE_DECIMALS` in `app/lib/hyperliquid.ts`; add the icon URL in `app/components/coin-icon.tsx`.

## Why webpack in dev

`next dev` uses `--webpack` to avoid Turbopack's per-session memory growth. Production builds are unaffected.

## Testing

vitest + jsdom. `vitest.setup.ts` stubs the Web Animations API and `matchMedia` (jsdom doesn't ship them) and wires `@testing-library` auto-cleanup.

47 tests across 6 files: `format` (24), `use-order-book` and `use-inside-tick` (10), `imbalance` and `ticks` math (10), and `BookRow`'s hover-freeze (3).
