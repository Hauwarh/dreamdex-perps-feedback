# fetchPositions reports the index price as `markPrice` (with `perpState: "ok"`) when the mark feed is stale, while fetchFundingRate reports `undefined` for the same pool

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` in this repo.
2. Run `node repro/02-position-fields.mjs` (offline).

The script feeds one stale pool state (`markPriceOk: false`, index live) through the exact field mappings both unified methods use in `src/unified/exchange.ts` @ 0.33.0:
- `fetchFundingRate` (L5737): `markPrice = markPriceOk && markPrice > 0 ? toHumanNum(markPrice) : undefined`
- `fetchPositions` (L5943 to L5959): `markPrice = perpMarkForPnl(state).price`, which falls back to `indexPrice`, and sets `perpState: "ok"`

## Expected
For the same pool at the same moment, both methods agree on whether a mark price exists. If `fetchPositions` deliberately falls back to the index for PnL, that is visible on the typed result, for example:
- a typed `markSource: "mark" | "index"` field, or
- `perpState: "degraded"` / a separate state value, or
- `markPrice: undefined` plus a separately named `pnlPrice`.

The `UnifiedPosition.markPrice` doc (`dist/unified/structs.d.ts` L571) says "Current EMA mark price", so it should only ever hold the mark.

## Actual
```
fetchFundingRate().markPrice : undefined
fetchPositions()[0].markPrice: 65000  <- actually the index price
fetchPositions()[0].unrealizedPnl: -500  <- priced off the index
only hint: info.markFromIndex = true (info is typed `unknown`)
perpState reported by fetchPositions: "ok"
```

A bot that reads `position.markPrice` to drive stops, risk checks or a UI gets the index price labelled as the mark, with `perpState: "ok"`. The only signal is `info.markFromIndex`, which sits inside an `unknown`-typed field and is not mentioned in the `UnifiedPosition` type docs. The SDK's own note on `perpMarkForPnl` (`src/perp/state.ts` L110 to L117) says callers that want a mark reading should report `undefined` on staleness, which `fetchFundingRate` does and `fetchPositions` does not.

## Evidence
- Repro script: `repro/02-position-fields.mjs` (output above).
- Source (0.33.0): `src/unified/exchange.ts` L5737 vs L5943 to L5959; `src/perp/state.ts` L120 to L129; `dist/unified/structs.d.ts` L560 to L575.
- 0.33.0 changed the case where the pool read fails entirely (now `perpState: "degraded"`, no mark), which makes the stale-mark case more inconsistent: a dead read is flagged, a stale mark is reported as `"ok"`.

## Suggested fix
- In `fetchPositions`, set `markPrice` only when `markPriceOk && markPrice > 0n`, matching `fetchFundingRate`.
- Keep the index-based PnL, but expose it honestly: add a typed `markSource: "mark" | "index"` to `UnifiedPosition` (promote `info.markFromIndex`), or report `perpState: "degraded"` when the mark is stale.
- Update the `UnifiedPosition.markPrice` doc to say what happens when the mark feed is stale.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (also 0.32.1)
- Network: Somnia Tokyo testnet (Hideki, chain id 50383); logic is network-independent
- Wallet address: not needed (offline repro)
