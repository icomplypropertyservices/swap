# Scripts inventory (hygiene) — xrpl-xumm-swap

**Role:** hygiene-scripts · **Status:** DONE_CANDIDATE  
**Scope:** permanent `test-*.mjs` under `scripts/` (swap). Do **not** delete these without review.

Auditor note: these are API / credential smoke checks for XUMM + xrpl.to. Keep in tree.

---

## Permanent `test-*.mjs` (KEEP)

| File | Size (approx) | Purpose | Run |
|------|---------------|---------|-----|
| `scripts/test-xumm.mjs` | ~1.1 KB | Create XUMM SignIn payload using `.env.local` (key length + status) | `node scripts/test-xumm.mjs` |
| `scripts/test-xumm-ping.mjs` | ~1 KB | Probe XUMM platform routes: payload POST, curated-assets, app/details, ping | `node scripts/test-xumm-ping.mjs` |
| `scripts/test-apis.mjs` | ~0.9 KB | Probe xrpl.to token API URL variants (status + sample body) | `node scripts/test-apis.mjs` |

### Related non-`test-*` (KEEP — not in delete scope)

| File | Notes |
|------|--------|
| `scripts/verify-token-flow.mjs` | End-to-end token flow verify |
| `scripts/try-xaman-return.mjs` | Xaman return-url flow |
| `scripts/sync-xumm-env.mjs` | Env sync helper |
| `scripts/find-tokens.mjs` | Token discovery |
| `scripts/check-fuzzy.mjs` | FUZZY token check |
| `scripts/inspect-xrplto.mjs` | xrpl.to inspect |
| `scripts/field-test.js` / `quick-quote-test.js` / `inspect-xrplto.js` | Older JS probes |

---

## Obvious tmp (DELETED this pass)

| File | Why tmp | Action |
|------|---------|--------|
| `scripts/tmp-check-tokens.mjs` | `tmp-` prefix; one-off FUZZY token dump against xrpl.to | **Deleted** 2026-07-26 |
| `scripts/tmp-parse-test.mjs` | `tmp-` prefix; ad-hoc `parseQuickToken` console smoke | **Deleted** 2026-07-26 |

---

## Hygiene policy

1. **Permanent `test-*.mjs`:** keep; document here if added.
2. **Obvious `tmp-*` only:** delete after noting here.
3. Prefer inventory over deletion when unsure.

**Inventory date:** 2026-07-26  
**Action taken:** inventory written; only obvious `tmp-*.mjs` removed; all permanent `test-*.mjs` retained.
