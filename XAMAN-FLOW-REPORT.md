# Xaman return/resume flow — Riddle Swap vs Bridge

Aligned `xrpl-xumm-swap` to the same Xaman return/resume pattern as `riddle-bridge`.  
Bridge was read-only reference; no bridge files were modified.

## Gaps found (before)

| Area | Gap |
|------|-----|
| **Swap / limit resume** | Pending uuid was written (`purpose: swap \| limit`) but **nothing resumed** after `?xaman=1` / reload. Bridge deposit resumes via `writePaymentPending` + poll. |
| **Wallet vs non-signin pending** | On return with stored address missing, wallet could treat **any** pending uuid as SignIn (including swap/limit). |
| **API key race** | SignIn resume set `resumedRef` before `apiKey` loaded from `localStorage`, so connect resume never ran. |
| **Poll return events** | Poll skipped ticks while `document.hidden`; visibility re-check existed but was weaker than bridge’s always-on interval + `visibilitychange` / `pageshow` / `focus`. |
| **Close / disconnect cleanup** | Closing payload modal and disconnect did not always `stripXamanQuery()`. |
| **OfferCancel purpose** | Cancel used `purpose: 'limit'`, same as OfferCreate — harder to disambiguate on resume. |
| **SSR / window guards** | `buildReturnUrl` / URL helpers assumed `window` always present. |
| **Deep-link open** | Desktop popup was basic; mobile native scheme OK but less aligned with bridge popup centering. |

What was already mostly correct:

- `return_url` via `xamanOptions()` on SignIn, swap Payment, OfferCreate, OfferCancel  
- Address in `riddle.swap.xaman.address`  
- Deep links `https://xumm.app/sign/{uuid}` + `xumm://xumm.app/sign/{uuid}`  
- Mobile auto-open native scheme without `location.href` unload  
- Desktop QR in `PayloadModal`

## Fixes made

### `src/utils/xamanSession.ts`
- Bridge-style helpers: `buildReturnUrl`, `resumeUuidFromUrl`, `isXamanReturn`, `stripXamanQuery`, pending R/W, address R/W  
- `xamanOptions({ submit, expire, uuid? })` always attaches `return_url: { app, web }` when `window` exists  
- Purposes: `signin` \| `swap` \| `limit` \| `cancel`  
- `resolveResumeUuid(purpose)` for purpose-scoped resume  
- `openXamanUrls`: mobile native first (SPA stays); desktop centered popup  

### `src/hooks/useXummPayload.ts`
- Interval poll continues (no skip solely because tab hidden)  
- Immediate re-check on `visibilitychange` / `pageshow` / `focus`  
- `writePending(uuid, purpose)` on poll start  
- `stripXamanQuery` + `clearPending` on terminal / close  
- Exposes `resumePoll`, `checkOnce`, `activeUuid`  

### `src/hooks/useWallet.ts`
- Resume **only** `purpose === 'signin'`  
- Wait for API key before marking resume done  
- Visibility re-poll for unfinished SignIn  
- Persist address; reconnect shows connected via `readStoredAddress`  
- Disconnect clears pending + strips `?xaman`  

### `src/hooks/useSwap/useSwap.ts`
- Resume pending **swap** after return/reload via `resolveResumeUuid('swap')` + `resumePoll`  
- Payment payloads keep `xamanOptions({ submit: true })` + `purpose: 'swap'`  

### `src/hooks/useLimitOrders/useLimitOrders.ts`
- Resume **limit** / **cancel** after return/reload  
- OfferCreate → `purpose: 'limit'`; OfferCancel → `purpose: 'cancel'`  
- Both use `return_url` via `xamanOptions`  

### `src/App.tsx`
- Wires `resumePoll`, `activeUuid`, `checkOnce` into wallet / swap / limit  

### `scripts/try-xaman-return.mjs`
- Unit-tests session helper contracts (no key required)  
- Source contract checks for return_url / resume / poll events  
- Optional live SignIn create if `XUMM_API_KEY` / `VITE_XUMM_API_KEY` / `XAMAN_API_KEY` is set  
- App UI key storage: `localStorage` key `xummApiKey` (not committed)  

## Verification

```text
npx tsc -b          # exit 0
node scripts/try-xaman-return.mjs   # all checks passed
```

Live payload create was skipped in this environment (no API key in env).

## Remaining issues / notes

1. **Resume UX for swap/limit** — After cold reload we re-poll the uuid and show the modal shell (deep link + status). We do **not** reconstruct the original quote/tx UI fields; signing is still recognized when the user approved in Xaman.  
2. **Single pending slot** — One localStorage pending payload at a time (same as bridge connect vs payment separation by key; swap uses purpose field on one key). Starting a new payload overwrites pending.  
3. **TTL** — Pending expires after 15 minutes.  
4. **Origins** — Xumm app “Allowed Origins” must include the deploy host or `*`, or create returns 403.  
5. **No secrets committed** — Do not put API keys in the repo; use env or UI `xummApiKey`.  
6. **E2E in real Xaman** — Full mobile return still needs manual/device test (sign → return_url → SPA resume). The script covers helpers + optional create only.

## Flow summary (aligned)

```text
Create payload (SignIn | Payment | OfferCreate | OfferCancel)
  → options.return_url = { app: ?xaman=1, web: ?xaman=1 }
  → writePending(uuid, purpose)
  → Desktop: QR on page | Mobile: xumm://… (SPA stays)
  → poll + re-check on visibility/pageshow/focus

User returns (?xaman=1 or ?xaman=<uuid>) / reloads
  → purpose=signin  → useWallet resume + store address
  → purpose=swap    → useSwap resumePoll
  → purpose=limit|cancel → useLimitOrders resumePoll
  → stripXamanQuery on terminal success/fail/close
```
