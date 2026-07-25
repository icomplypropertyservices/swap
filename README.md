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
- Connect using Xaman (QR + deep link)
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
