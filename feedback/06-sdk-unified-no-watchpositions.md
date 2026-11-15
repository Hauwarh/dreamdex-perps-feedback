# Unified exchange has no watchPositions, although the raw tier already streams live perp positions

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` in this repo.
2. Search `node_modules/@somnia-chain/markets-sdk/dist/unified/exchange.d.ts` for `watchPositions`: not found. The unified layer has `watchOrderBook`, `watchTrades`, `watchOrders`, `watchMyTrades` and `watchPrice`, but no position stream.
3. Compare with `client.accountPositions.subscribe(marginBank, account, onView)` in `src/accountView/positionsClient.ts` L129 to L203, which pushes a complete positions + margin view on every MarginBank event and every price write.

## Expected
A ccxt-style `watchPositions(symbols?)` that resolves on each change, backed by the existing `accountPositions.subscribe` push. Bots and agents need to react to fills, liquidation risk and PnL moves, and the push machinery is already built.

## Actual
Unified users must either poll `fetchPositions()` (several chain reads per position per call, see `src/unified/exchange.ts` L5867 to L5966) or drop to `exchange.client.accountPositions.subscribe(...)` with a raw MarginBank address and the raw view shape. Polling adds RPC load and misses fast liquidation moves between polls.

## Evidence
- `dist/unified/exchange.d.ts`: no `watchPositions`; `has` map L394 to L442 has no position-watch key.
- `src/accountView/positionsClient.ts` L129 to L203 (`subscribe`, push on events and price writes).

## Suggested fix
- Add `watchPositions(symbols?: string[])` that wraps `client.accountPositions.subscribe(marginBank, account, onView)` and resolves with `UnifiedPosition[]` built by the same mapper `fetchPositions` uses.
- Add `watchPositions: true` to `has`.
- Note in EXCHANGE.md that the stream updates on MarginBank events and price writes, so it also moves on mark changes without a fill.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (also 0.32.1)
- Network: Somnia Tokyo testnet (Hideki, chain id 50383)
- Wallet address: not needed
