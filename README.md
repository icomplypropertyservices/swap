# XRPL Swap — Xaman (Xumm) + xrpl.to

A clean, self-contained token swap dapp for the XRP Ledger DEX.

- Uses **Xaman** (via Xumm REST API) for signing — exactly what the official [Xumm SDK](https://docs.xaman.dev/js-ts-sdk/xumm-sdk-intro) does.
- Pulls token metadata inspiration from **xrpl.to**.
- Queries live order books using `xrpl.js` (`book_offers`).
- Executes swaps via a self `Payment` transaction (standard DEX swap pattern).

## Features

- **Swap tab** — Immediate market swap using Payment (with slippage)
- **Limit Orders tab** — Place real XRPL limit orders (OfferCreate)
  - Set exact price
  - Expiration (GTC / 1h / 1d / 7d)
  - "Use market price" helper
  - View + cancel your open orders (OfferCancel)
- Connect using **Riddle Wallet** (deep link `wallet.riddlewallet.com`) or **Xaman** (QR + deep link)
- Platform fee: **0.5%** while a Riddle Wallet session is active; otherwise existing rate (default **0%**)
- Live DEX quotes via `book_offers`
- Custom tokens support (paste currency + issuer straight from xrpl.to)
- Multiple popular tokens included (SOLO, GateHub USD/EUR, Bitstamp USD, CSC, XRP)
- Balance display (XRP + trustlines)
- Full payload status polling + tx explorer link after signing

## How to run

Make sure you're in the project folder, then:

```powershell
cd xrpl-xumm-swap
npm install
npm run dev
```

- The browser should open automatically to http://localhost:5173
- If it doesn't open, manually visit http://localhost:5173 in your browser
- If you see a blank page, check the browser console (F12) for errors and make sure the terminal shows "VITE ready"

## Connect: Riddle Wallet + Xaman

Header / wallet section expose a **Connect** menu:

| Option | Behavior |
| --- | --- |
| **Riddle Wallet** | Opens `https://wallet.riddlewallet.com?return=…&app=swap&action=connect` (override origin with `VITE_WALLET_URL`). Session stored as `riddle_wallet_session` (postMessage or `?rw_address=` handoff). |
| **Xaman** | Existing SignIn payload via `/api/xaman/payload` (QR + deep link). |

Protocol source of truth: `riddle-wallet/lib/suite-connect.ts` · thin copy: `src/lib/riddleWallet.ts`.

### Platform fee

| Session | Fee |
| --- | --- |
| Riddle Wallet (`riddle_wallet_session`) | **50 bps (0.5%)** on min receive |
| Otherwise | **`VITE_PLATFORM_FEE_BPS`** (default **0** — keep prior no-fee behavior) |

Fee is applied as a haircut on the quoted receive amount when `feeBps > 0`.

| Env var | Purpose |
| --- | --- |
| **`VITE_WALLET_URL`** | Riddle Wallet origin. Default: `https://wallet.riddlewallet.com` |
| `VITE_PLATFORM_FEE_BPS` | Non–Riddle Wallet platform fee in basis points (default `0`) |
| `NEXT_PUBLIC_WALLET_URL` / `NEXT_PUBLIC_PLATFORM_FEE_BPS` | Same (suite / Next-style aliases) |

## Sponsored ads (swap.banner / swap.sidebar)

The swap UI loads sponsored creatives via `AdSlot` (`src/components/AdSlot.tsx`).

| Env var | Purpose |
| --- | --- |
| **`NEXT_PUBLIC_ADS_API_BASE`** | Ads API origin (no trailing slash). Default: `https://dev.riddlewallet.com` |
| `NEXT_PUBLIC_ADS_API` | Optional full active-ads URL; `slot` query is still appended |
| `VITE_ADS_API_BASE` / `VITE_ADS_API` | Same as above (Vite-native aliases) |

Request shape:

```
GET {NEXT_PUBLIC_ADS_API_BASE}/api/ads/active?slot=swap.banner
GET {NEXT_PUBLIC_ADS_API_BASE}/api/ads/active?slot=swap.sidebar
```

Expected JSON fields (flexible aliases supported): `title`, `clickUrl`, optional `body` / `imageUrl` / `sponsor` / `cta`.

If the API is down or returns no creative, a local mock is shown so layout stays stable. Banner sits above the main swap card; sidebar shows on `xl+` viewports only. Ads never touch Xaman/payload/swap state.

Example `.env.local`:

```
NEXT_PUBLIC_ADS_API_BASE=https://dev.riddlewallet.com
```

## Required: Xumm API Key

## Required: Xumm API Key (to avoid 403 errors)

1. Go to https://apps.xumm.dev
2. Create a new app (or use existing one)
3. **Critical for 403s**: In app settings, add Allowed Origins: `http://localhost:5173` (or `*` for testing). Without this, Xumm API returns 403 Forbidden.
4. Copy the **API Key** (secret not required for this client)
5. Paste into the "XUMM API KEY REQUIRED" field at top of app (persisted in localStorage)

The app uses direct REST calls to Xumm (`https://xumm.app/api/v1/platform/payload`). 403 usually means wrong key or origin not whitelisted.

## Using tokens from xrpl.to

- Open any token page on https://xrpl.to
- Copy:
  - Symbol / ticker
  - Currency code (3 letters or the 40-char hex)
  - Issuer r-address
- Click **"Add custom token (from xrpl.to)"** in the swap UI and paste the values.

## Swap mechanics

- **Swap tab**: Builds a `Payment` transaction (self-send with `SendMax` / `Amount`) for immediate fill against the book.
- **Limit tab**: Builds an `OfferCreate` (with `TakerGets` + `TakerPays` + optional `Expiration`). Cancel uses `OfferCancel`.

Both are submitted via Xumm (`submit: true`).

This is the native XRPL DEX — no AMM or bridges involved.

## Notes / Warnings

- You must have a trust line to the destination token (unless XRP).
- Always double-check token issuers on xrpl.to.
- Only use API keys you trust.
- This is a demo / educational project.

## Related

- Xumm SDK docs: https://docs.xaman.dev/js-ts-sdk/xumm-sdk-intro
- xrpl.to — token explorer & directory
- xrpl.js: https://xrpl.org
- Xaman: https://xaman.app

MIT / demo use.
